import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

import type { Sql, TransactionSql } from "postgres";

import { badRequest, notFound } from "../domain/errors";
import { uuid } from "../domain/validate";
import { seedCatalog } from "../infrastructure/tenant-sql";

import { decryptBackup, encryptBackup } from "./backup-crypto";
import { run } from "./run";
import type { RequestContext } from "./context";
import { findTenantUsers } from "./user-directory";

/** Dependency order. Restore deletes in reverse and inserts in this order. */
const TABLES: { name: string; columns: string[]; json?: string[] }[] = [
  {
    name: "resource",
    columns: ["key", "name", "description", "system", "created_at"],
  },
  {
    name: "team",
    columns: [
      "id",
      "name",
      "description",
      "created_by",
      "created_at",
      "updated_at",
      "deleted_at",
    ],
  },
  {
    name: "team_member",
    columns: ["team_id", "user_id", "role", "created_at"],
  },
  {
    name: "pbac",
    columns: [
      "id",
      "name",
      "description",
      "effect",
      "enabled",
      "created_by",
      "created_at",
      "updated_at",
    ],
  },
  { name: "pbac_subject", columns: ["id", "pbac_id", "kind", "value"] },
  {
    name: "pbac_target",
    columns: ["id", "pbac_id", "resource", "action", "resource_id"],
  },
  {
    name: "pbac_condition",
    columns: [
      "id",
      "pbac_id",
      "attribute",
      "operator",
      "value",
      "value_is_attribute",
    ],
    json: ["value"],
  },
  {
    name: "setting",
    columns: ["key", "value", "updated_by", "updated_at"],
    json: ["value"],
  },
  { name: "business_definition", columns: ["id", "key", "name", "description", "status", "version", "created_by", "created_at", "updated_at"] },
  { name: "business_table", columns: ["id", "business_id", "resource_key", "key", "name", "physical_table", "kind", "definition", "position", "created_at", "updated_at"], json: ["definition"] },
  { name: "business_relation", columns: ["id", "business_id", "from_table_id", "to_table_id", "from_field", "to_field", "relation_type", "created_at"] },
  { name: "business_calculation", columns: ["id", "business_id", "target_table_id", "key", "name", "expression", "dependencies", "created_at"], json: ["dependencies"] },
  { name: "business_snapshot", columns: ["id", "business_id", "label", "table_name", "row_count", "storage_key", "created_by", "created_at"] },
  { name: "business_field", columns: ["id", "table_id", "key", "label", "data_type", "input_type", "required", "searchable", "sensitive", "definition", "position", "created_at", "updated_at"], json: ["definition"] },
  { name: "business_field_reference", columns: ["id", "field_id", "path", "target_resource", "target_field", "display_field", "allow_many", "created_at"] },
  { name: "business_field_calculation", columns: ["id", "field_id", "path", "operation", "source_resource", "source_field", "match_local_field", "match_source_field", "expression", "refresh_mode", "created_at"], json: ["expression"] },
];

const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;
type Row = Record<string, unknown>;
type QuerySql = Sql | TransactionSql;

interface Manifest {
  format: 1;
  tenantId: string;
  createdAt: string;
  createdBy: string;
  tables: Record<string, Row[]>;
  physicalTables: Record<string, Row[]>;
}

function root() {
  return path.resolve(process.env.BACKUP_DIR ?? "./.backups");
}
function filePath(tenantId: string, id: string) {
  return path.join(root(), tenantId, `${id}.opslybk`);
}

async function snapshotToFile(
  sql: QuerySql,
  ctx: RequestContext,
  label: string,
) {
  const tables: Record<string, Row[]> = {};
  for (const t of TABLES) {
    tables[t.name] = [
      ...(await sql<Row[]>`select ${sql(t.columns)} from ${sql(t.name)}`),
    ];
  }

  const physicalTables: Record<string, Row[]> = {};
  const definitions = await sql<{ physical_table: string }[]>`select physical_table from business_table`;
  for (const table of definitions) {
    physicalTables[table.physical_table] = [...(await sql<Row[]>`select * from ${sql(table.physical_table)}`)];
  }

  const manifest: Manifest = {
    format: 1,
    tenantId: ctx.tenantId,
    createdAt: new Date().toISOString(),
    createdBy: ctx.userId,
    tables,
    physicalTables,
  };
  const file = encryptBackup(
    Buffer.from(JSON.stringify(manifest)),
    ctx.tenantId,
  );

  const id = randomUUID();
  await mkdir(path.dirname(filePath(ctx.tenantId, id)), { recursive: true });
  await writeFile(filePath(ctx.tenantId, id), file, { mode: 0o600 });

  const fileName = `opsly-${label}-${manifest.createdAt.replaceAll(":", "-").slice(0, 19)}.opslybk`;
  const sha256 = createHash("sha256").update(file).digest("hex");
  await sql`
    insert into backup (id, file_name, size_bytes, sha256, created_by)
    values (${id}, ${fileName}, ${file.length}, ${sha256}, ${ctx.userId})`;

  return {
    id,
    fileName,
    sizeBytes: file.length,
    rowCounts: Object.fromEntries(
      Object.entries(tables).map(([k, v]) => [k, v.length]),
    ),
  };
}

async function readStored(
  sql: QuerySql,
  tenantId: string,
  id: string,
): Promise<Buffer> {
  const [meta] = await sql<
    { sha256: string }[]
  >`select sha256 from backup where id = ${id}`;
  if (!meta) throw notFound("Backup");
  let data: Buffer;
  try {
    data = await readFile(filePath(tenantId, id));
  } catch {
    throw notFound("Backup file");
  }
  if (createHash("sha256").update(data).digest("hex") !== meta.sha256) {
    throw badRequest("The backup file has been changed since it was created.");
  }
  return data;
}

export async function listBackups() {
  return run(
    { resource: "backup", action: "viewAny" },
    ({ sql }) =>
      sql`select id, file_name, size_bytes, created_by, created_at from backup order by created_at desc`,
  );
}

export async function createBackup() {
  return run(
    { resource: "backup", action: "create" },
    async ({ ctx, sql, note }) => {
      // Must be the first statement in the transaction: one consistent snapshot.
      await sql`set transaction isolation level repeatable read`;
      const result = await snapshotToFile(sql, ctx, "backup");
      note({
        resourceId: result.id,
        details: {
          fileName: result.fileName,
          sizeBytes: result.sizeBytes,
          rowCounts: result.rowCounts,
        },
      });
      return result;
    },
  );
}

export async function downloadBackup(id: string) {
  uuid(id, "Backup id");
  return run(
    { resource: "backup", action: "export", resourceId: id },
    async ({ ctx, sql, note }) => {
      const data = await readStored(sql, ctx.tenantId, id);
      const [meta] = await sql<
        { file_name: string }[]
      >`select file_name from backup where id = ${id}`;
      note({ details: { fileName: meta.file_name } });
      return { fileName: meta.file_name, data };
    },
  );
}

export async function deleteBackup(id: string) {
  uuid(id, "Backup id");
  return run(
    { resource: "backup", action: "delete", resourceId: id },
    async ({ ctx, sql, note }) => {
      const [meta] = await sql<
        { file_name: string }[]
      >`delete from backup where id = ${id} returning file_name`;
      if (!meta) throw notFound("Backup");
      await unlink(filePath(ctx.tenantId, id)).catch((e: { code?: string }) => {
        if (e.code !== "ENOENT") throw e;
      });
      note({ details: { fileName: meta.file_name } });
      return { id };
    },
  );
}

function parseManifest(plain: Buffer, tenantId: string): Manifest {
  let m: Manifest;
  try {
    m = JSON.parse(plain.toString("utf8"));
  } catch {
    throw badRequest("The backup content is unreadable.");
  }
  if (m?.format !== 1 || typeof m.tables !== "object" || m.tables === null) {
    throw badRequest(
      "This backup was made by an unsupported version of Opsly.",
    );
  }
  if (m.physicalTables !== undefined && (typeof m.physicalTables !== "object" || m.physicalTables === null)) throw badRequest("The backup's physical table data is invalid.");
  if (m.tenantId !== tenantId)
    throw badRequest("This backup belongs to a different workspace.");
  for (const t of TABLES) {
    if (m.tables[t.name] !== undefined && !Array.isArray(m.tables[t.name])) {
      throw badRequest(`The backup's ${t.name} data is invalid.`);
    }
  }
  return m;
}

export async function restoreBackup(input: {
  backupId?: string;
  file?: Buffer;
  confirm: boolean;
}) {
  if (!input.confirm)
    throw badRequest(
      "Confirm the restore. It replaces current teams, policies, resources and settings.",
    );
  if (!input.backupId && !input.file)
    throw badRequest("Choose a backup or upload a file.");
  if (input.file && input.file.length > MAX_UPLOAD_BYTES)
    throw badRequest("Backup file is too large.");

  return run(
    { resource: "backup", action: "restore", resourceId: input.backupId },
    async ({ ctx, sql, note }) => {
      const encrypted =
        input.file ?? (await readStored(sql, ctx.tenantId, input.backupId!));
      const manifest = parseManifest(
        decryptBackup(encrypted, ctx.tenantId),
        ctx.tenantId,
      );

      // Safety net: a restorable copy of what we're about to replace.
      const safety = await snapshotToFile(sql, ctx, "pre-restore");

      const oldPhysicalTables = await sql<{ physical_table: string }[]>`select physical_table from business_table`;
      for (const table of oldPhysicalTables) await sql.unsafe(`drop table if exists "${table.physical_table}"`);

      // Members whose accounts no longer exist are dropped.
      const memberIds = [
        ...new Set(
          (manifest.tables.team_member ?? []).map((m) => String(m.user_id)),
        ),
      ];
      const validUsers = await findTenantUsers(ctx.tenantId, memberIds);

      for (const t of [...TABLES].reverse()) {
        await sql`delete from ${sql(t.name)}`;
      }

      const rowCounts: Record<string, number> = {};
      let skippedMembers = 0;

      for (const t of TABLES) {
        let count = 0;
        for (const source of manifest.tables[t.name] ?? []) {
          if (
            t.name === "team_member" &&
            !validUsers.has(String(source.user_id))
          ) {
            skippedMembers++;
            continue;
          }
          const row: Row = {};
          for (const c of t.columns) {
            const v = source[c] ?? null;
            row[c] =
              t.json?.includes(c) && v !== null ? sql.json(v as never) : v;
          }
          await sql`insert into ${sql(t.name)} ${sql(row, ...t.columns)}`;
          count++;
        }
        rowCounts[t.name] = count;
      }

      await seedCatalog(sql);

      const restoredPhysicalTables = manifest.physicalTables ?? {};
      const definitions = await sql<{ physical_table: string; definition: { fields?: { key: string; type?: string; required?: boolean }[] } }[]>`select physical_table, definition from business_table`;
      const typeMap: Record<string, string> = { text: "text", number: "numeric", boolean: "boolean", date: "date", datetime: "timestamptz", uuid: "uuid", json: "jsonb" };
      for (const table of definitions) {
        const fields = (table.definition?.fields ?? []).map((field) => `"${field.key}" ${typeMap[field.type ?? "text"] ?? "text"}${field.required ? " not null" : ""}`).join(", ");
        await sql.unsafe(`create table if not exists "${table.physical_table}" ("id" uuid primary key default gen_random_uuid(), ${fields ? `${fields}, ` : ""}"created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now())`);
        for (const row of restoredPhysicalTables[table.physical_table] ?? []) {
          const columns = Object.keys(row).filter((column) => /^[a-z][a-z0-9_]*$/.test(column));
          if (columns.length) await sql`insert into ${sql(table.physical_table)} ${sql(row, ...columns)}`;
        }
      }

      note({
        details: {
          source: input.backupId ?? "upload",
          backupCreatedAt: manifest.createdAt,
          preRestoreBackupId: safety.id,
          rowCounts,
          skippedMembers,
        },
      });
      return {
        restored: true,
        preRestoreBackupId: safety.id,
        rowCounts,
        skippedMembers,
      };
    },
  );
}
