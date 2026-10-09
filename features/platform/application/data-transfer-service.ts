import "server-only";

import { randomBytes } from "node:crypto";

import { and, eq, isNull } from "drizzle-orm";

import { hashPassword } from "@/features/auth/infrastructure/password-hasher";
import { appUser, role } from "@/features/auth/infrastructure/schema";
import { primaryDb } from "@/features/database/server/primary-database";

import { HttpError, badRequest, notFound } from "../domain/errors";
import {
  IMPORTABLE_ENTITIES,
  TRANSFER_ENTITIES,
  type TransferEntity,
} from "../domain/permissions";
import { asObject, email, oneOf, optText, text } from "../domain/validate";

import { loadPolicies } from "./authorize";
import { run } from "./run";
import { ASSIGNABLE_ROLES, ensureRole } from "./user-service";

const MAX_IMPORT_ROWS = 500;
const MAX_IMPORT_CHARS = 2_000_000;
const MAX_EXPORT_ROWS = 10_000;

type Row = Record<string, unknown>;

/* ---------------- CSV ---------------- */

export function toCsv(rows: Row[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const cell = (v: unknown) => {
    let s =
      v === null || v === undefined
        ? ""
        : v instanceof Date
          ? v.toISOString()
          : typeof v === "object"
            ? JSON.stringify(v)
            : String(v);
    // Stop spreadsheets from running cells that start like formulas.
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return /[",\n\r]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
  };
  return [
    headers.join(","),
    ...rows.map((r) => headers.map((h) => cell(r[h])).join(",")),
  ].join("\n");
}

export function parseCsv(input: string): Row[] {
  const records: string[][] = [];
  let field = "",
    record: string[] = [],
    quoted = false;
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (quoted) {
      if (ch === '"' && input[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      record.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && input[i + 1] === "\n") i++;
      record.push(field);
      field = "";
      if (record.some((c) => c !== "")) records.push(record);
      record = [];
    } else field += ch;
  }
  record.push(field);
  if (record.some((c) => c !== "")) records.push(record);

  const [header, ...body] = records;
  if (!header) return [];
  const keys = header.map((h) => h.trim());
  return body.map((r) =>
    Object.fromEntries(keys.map((k, i) => [k, r[i] ?? ""])),
  );
}

/* ---------------- Export ---------------- */

function entityOf(value: string): TransferEntity {
  if (!(TRANSFER_ENTITIES as readonly string[]).includes(value))
    throw notFound("Export type");
  return value as TransferEntity;
}

export async function exportEntity(entityParam: string, formatParam: string) {
  const entity = entityOf(entityParam);
  const format = oneOf(formatParam, "Format", ["json", "csv"] as const);
  if (entity === "pbac" && format === "csv")
    throw badRequest("Policies export as JSON only.");

  return run(
    { resource: entity, action: "export" },
    async ({ ctx, sql, note }) => {
      let rows: Row[];

      switch (entity) {
        case "team":
          rows = await sql`select name, description, created_at from team
                         where deleted_at is null order by lower(name)`;
          break;
        case "resource":
          rows =
            await sql`select key, name, description, system from resource order by key`;
          break;
        case "audit":
          rows =
            await sql`select created_at, actor_email, resource, action, resource_id, outcome, ip
                         from audit_log order by created_at desc limit ${MAX_EXPORT_ROWS}`;
          break;
        case "pbac":
          rows = (await loadPolicies(sql)) as unknown as Row[];
          break;
        case "user":
          rows = await primaryDb
            .select({
              email: appUser.email,
              role: role.key,
              status: appUser.status,
              createdAt: appUser.createdAt,
            })
            .from(appUser)
            .innerJoin(role, eq(appUser.roleId, role.id))
            .where(
              and(
                eq(appUser.tenantId, ctx.tenantId),
                isNull(appUser.deletedAt),
              ),
            );
          break;
      }

      note({ details: { entity, format, count: rows.length } });

      const stamp = new Date().toISOString().slice(0, 10);
      return {
        fileName: `opsly-${entity}-${stamp}.${format}`,
        contentType:
          format === "csv" ? "text/csv; charset=utf-8" : "application/json",
        body: format === "csv" ? toCsv(rows) : JSON.stringify(rows, null, 2),
      };
    },
  );
}

/* ---------------- Import ---------------- */

export async function readImportRows(req: Request): Promise<Row[]> {
  const raw = await req.text();
  if (raw.length > MAX_IMPORT_CHARS)
    throw badRequest("File is too large. Split it into smaller imports.");

  const type = req.headers.get("content-type") ?? "";
  if (type.includes("csv")) return parseCsv(raw);

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw badRequest("Send valid JSON or CSV.");
  }
  const rows = Array.isArray(parsed) ? parsed : asObject(parsed).rows;
  if (!Array.isArray(rows))
    throw badRequest('Send a list of rows, or { "rows": [...] }.');
  return rows as Row[];
}

interface ImportResult {
  created: number;
  updated: number;
  errors: { row: number; message: string }[];
  /** Shown once. Passwords are never stored in the audit log. */
  credentials?: { email: string; password: string }[];
}

export async function importEntity(
  entityParam: string,
  rows: Row[],
): Promise<ImportResult> {
  const entity = entityOf(entityParam);
  if (!(IMPORTABLE_ENTITIES as readonly string[]).includes(entity)) {
    throw badRequest(`Import isn't available for ${entity}.`);
  }
  if (rows.length === 0) throw badRequest("The file has no rows.");
  if (rows.length > MAX_IMPORT_ROWS)
    throw badRequest(`Import up to ${MAX_IMPORT_ROWS} rows at a time.`);

  return run(
    { resource: entity, action: "import" },
    async ({ ctx, sql, note }) => {
      const result: ImportResult = { created: 0, updated: 0, errors: [] };
      if (entity === "user") result.credentials = [];

      for (const [i, raw] of rows.entries()) {
        try {
          const r = asObject(raw, "Row");

          if (entity === "team") {
            const name = text(r.name, "name", { max: 100 });
            const description = optText(r.description, "description");
            const [existing] = await sql<{ id: string }[]>`
            select id from team where lower(name) = lower(${name}) and deleted_at is null`;
            if (existing) {
              await sql`update team set description = ${description}, updated_at = now() where id = ${existing.id}`;
              result.updated++;
            } else {
              await sql`insert into team (name, description, created_by) values (${name}, ${description}, ${ctx.userId})`;
              result.created++;
            }
          }

          if (entity === "resource") {
            const key = text(r.key, "key", { max: 40 });
            if (!/^[a-z][a-z0-9_]{1,39}$/.test(key))
              throw badRequest("key is invalid.");
            const name = text(r.name, "name", { max: 100 });
            const description = optText(r.description, "description");
            const [existing] = await sql<
              { system: boolean }[]
            >`select system from resource where key = ${key}`;
            if (existing?.system)
              throw badRequest("System resources can't be changed.");
            if (existing) {
              await sql`update resource set name = ${name}, description = ${description} where key = ${key}`;
              result.updated++;
            } else {
              await sql`insert into resource (key, name, description) values (${key}, ${name}, ${description})`;
              result.created++;
            }
          }

          if (entity === "user") {
            const userEmail = email(r.email);
            const roleKey = oneOf(r.role || "member", "role", ASSIGNABLE_ROLES);
            const roleRow = await ensureRole(roleKey);
            const [existing] = await primaryDb
              .select({ id: appUser.id, role: role.key })
              .from(appUser)
              .innerJoin(role, eq(appUser.roleId, role.id))
              .where(
                and(
                  eq(appUser.tenantId, ctx.tenantId),
                  eq(appUser.email, userEmail),
                  isNull(appUser.deletedAt),
                ),
              )
              .limit(1);

            if (existing) {
              if (existing.role === "owner")
                throw badRequest("The owner can't be changed by import.");
              await primaryDb
                .update(appUser)
                .set({ roleId: roleRow.id, updatedAt: new Date() })
                .where(eq(appUser.id, existing.id));
              result.updated++;
            } else {
              const password = randomBytes(12).toString("base64url");
              await primaryDb.insert(appUser).values({
                tenantId: ctx.tenantId,
                roleId: roleRow.id,
                email: userEmail,
                passwordHash: await hashPassword(password),
                status: "active",
              });
              result.credentials!.push({ email: userEmail, password });
              result.created++;
            }
          }
        } catch (error) {
          // Validation problems skip the row. Database errors abort the whole import.
          if (!(error instanceof HttpError)) throw error;
          result.errors.push({ row: i + 1, message: error.message });
        }
      }

      note({
        details: {
          entity,
          rows: rows.length,
          created: result.created,
          updated: result.updated,
          errors: result.errors.length,
        },
      });
      return result;
    },
  );
}
