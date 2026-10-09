import "server-only";
import { createHash } from "node:crypto";
import type { Sql, TransactionSql } from "postgres";
import { tenantDatabaseManager } from "@/features/database/server/tenant-database-manager";
import { ACTIONS, SYSTEM_RESOURCES, isLogged } from "../domain/permissions";
import { MIGRATIONS } from "./tenant-migrations";

const DDL = `
create table if not exists resource (
  key text primary key,
  name text not null,
  description text,
  system boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists action (
  key text primary key,
  name text not null,
  logged boolean not null
);

create table if not exists team (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create unique index if not exists team_name_unique
  on team (lower(name)) where deleted_at is null;

create table if not exists team_member (
  team_id uuid not null references team(id) on delete cascade,
  user_id uuid not null,
  role text not null default 'member' check (role in ('lead','member')),
  created_at timestamptz not null default now(),
  primary key (team_id, user_id)
);
create index if not exists team_member_user on team_member (user_id);

create table if not exists pbac (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  effect text not null check (effect in ('allow','deny')),
  enabled boolean not null default true,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists pbac_subject (
  id uuid primary key default gen_random_uuid(),
  pbac_id uuid not null references pbac(id) on delete cascade,
  kind text not null check (kind in ('user','role','team','everyone')),
  value text
);

create table if not exists pbac_target (
  id uuid primary key default gen_random_uuid(),
  pbac_id uuid not null references pbac(id) on delete cascade,
  resource text not null default '*',
  action text not null default '*',
  resource_id text
);

create table if not exists pbac_condition (
  id uuid primary key default gen_random_uuid(),
  pbac_id uuid not null references pbac(id) on delete cascade,
  attribute text not null,
  operator text not null check (operator in
    ('eq','neq','in','notIn','contains','gt','gte','lt','lte')),
  value jsonb,
  value_is_attribute boolean not null default false
);

create table if not exists setting (
  key text primary key,
  value jsonb not null,
  updated_by uuid,
  updated_at timestamptz not null default now()
);

create table if not exists backup (
  id uuid primary key,
  file_name text not null,
  size_bytes bigint not null,
  sha256 text not null,
  created_by uuid,
  created_at timestamptz not null default now()
);

create table if not exists audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid,
  actor_email text,
  resource text not null,
  action text not null,
  resource_id text,
  outcome text not null check (outcome in ('success','denied','failure')),
  details jsonb,
  ip text,
  user_agent text,
  created_at timestamptz not null default now()
);
create index if not exists audit_log_created on audit_log (created_at desc);
create index if not exists audit_log_resource on audit_log (resource, action);

create or replace function audit_log_immutable() returns trigger as $$
begin
  raise exception 'audit_log is append-only';
end;
$$ language plpgsql;

drop trigger if exists audit_log_no_change on audit_log;
create trigger audit_log_no_change
  before update or delete on audit_log
  for each row execute function audit_log_immutable();

create table if not exists meta (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);
`;

type SqlExecutor = Sql | TransactionSql;

const SYSTEM_POLICIES = [
  {
    name: "Admins manage everything",
    effect: "allow",
    subjects: [{ kind: "role", value: "admin" }],
    targets: [{ resource: "*", action: "*" }],
  },
  {
    name: "Members can view",
    effect: "allow",
    subjects: [{ kind: "role", value: "member" }],
    targets: [
      { resource: "*", action: "view" },
      { resource: "*", action: "viewAny" },
    ],
  },
  {
    name: "Members can't see audit, policies or backups",
    effect: "deny",
    subjects: [{ kind: "role", value: "member" }],
    targets: [
      { resource: "audit", action: "*" },
      { resource: "pbac", action: "*" },
      { resource: "backup", action: "*" },
    ],
  },
] as const;

const SCHEMA_HASH = createHash("sha256")
  .update(
    JSON.stringify([
      DDL,
      MIGRATIONS,
      ACTIONS,
      SYSTEM_RESOURCES,
      SYSTEM_POLICIES,
    ]),
  )
  .digest("hex");

const g = globalThis as unknown as {
  opslyTenantReady?: Map<string, Promise<void>>;
};
const ready = (g.opslyTenantReady ??= new Map());

/** Tenant connection with the schema and seeds guaranteed current. */
export async function getTenantSql(tenantId: string): Promise<Sql> {
  const { client } = await tenantDatabaseManager.get(tenantId);

  let pending = ready.get(tenantId);
  if (!pending) {
    pending = initializeTenantSchema(client).catch((error) => {
      ready.delete(tenantId);
      throw error;
    });
    ready.set(tenantId, pending);
  }

  await pending;
  return client;
}

async function hasCurrentSchemaHash(sql: SqlExecutor): Promise<boolean> {
  const [meta] = await sql<{ table_name: string | null }[]>`
    select to_regclass('public.meta')::text as table_name`;
  if (!meta?.table_name) return false;

  const [row] = await sql<{ value: string }[]>`
    select value from meta where key = 'schema_hash'`;
  return row?.value === SCHEMA_HASH;
}

export async function applyMigrations(tx: TransactionSql): Promise<void> {
  await tx`
    create table if not exists schema_migration (
      id integer primary key,
      name text not null,
      applied_at timestamptz not null default now()
    )`;

  const applied = await tx<{ id: number }[]>`
    select id from schema_migration`;
  const appliedIds = new Set(applied.map((migration) => migration.id));

  for (const migration of [...MIGRATIONS].sort((a, b) => a.id - b.id)) {
    if (appliedIds.has(migration.id)) continue;
    await tx.unsafe(migration.sql);
    await tx`
      insert into schema_migration (id, name)
      values (${migration.id}, ${migration.name})`;
  }
}

/** Idempotent: system actions and resources. Safe to call again after a restore. */
export async function seedCatalog(sql: SqlExecutor) {
  for (const a of ACTIONS) {
    await sql`
      insert into action (key, name, logged)
      values (${a.key}, ${a.name}, ${isLogged(a.key)})
      on conflict (key) do update set name = excluded.name, logged = excluded.logged`;
  }
  for (const r of SYSTEM_RESOURCES) {
    await sql`
      insert into resource (key, name, system)
      values (${r.key}, ${r.name}, true)
      on conflict (key) do update set name = excluded.name, system = true`;
  }
}

interface SeedSubject {
  kind: string;
  value: string | null;
}
interface SeedTarget {
  resource: string;
  action: string;
}

async function seedPolicy(
  sql: SqlExecutor,
  name: string,
  effect: "allow" | "deny",
  subjects: readonly SeedSubject[],
  targets: readonly SeedTarget[],
) {
  const [row] = await sql<{ id: string }[]>`
    insert into pbac (name, effect) values (${name}, ${effect}) returning id`;
  for (const s of subjects) {
    await sql`insert into pbac_subject (pbac_id, kind, value) values (${row.id}, ${s.kind}, ${s.value})`;
  }
  for (const t of targets) {
    await sql`insert into pbac_target (pbac_id, resource, action) values (${row.id}, ${t.resource}, ${t.action})`;
  }
}

async function seedDefaultPolicies(sql: SqlExecutor) {
  const [{ n }] = await sql<
    { n: number }[]
  >`select count(*)::int as n from pbac`;
  if (n > 0) return;

  for (const policy of SYSTEM_POLICIES) {
    await seedPolicy(
      sql,
      policy.name,
      policy.effect,
      policy.subjects,
      policy.targets,
    );
  }
}

async function seedSystemPolicies(sql: SqlExecutor) {
  await seedDefaultPolicies(sql);
}

async function seedTenantRoles(sql: SqlExecutor) {
  for (const role of [
    { key: "owner", name: "Workspace owner" },
    { key: "admin", name: "Administrator" },
    { key: "member", name: "Member" },
  ]) {
    await sql`
      insert into workspace_role (key, name, system)
      values (${role.key}, ${role.name}, true)
      on conflict (key) do update set name = excluded.name, system = true`;
  }
}

/**
 * Creates the business tables in one tenant database, then seeds the
 * permission catalog and PBAC policies. The bootstrap transaction is guarded
 * by a process-local promise and a database advisory lock.
 */
export async function initializeTenantSchema(client: Sql): Promise<void> {
  if (await hasCurrentSchemaHash(client)) return;

  await client.begin(async (tx) => {
    await tx`select pg_advisory_xact_lock(727301)`;
    if (await hasCurrentSchemaHash(tx)) return;

    await tx.unsafe(DDL);
    await applyMigrations(tx);
    await seedCatalog(tx);
    await seedTenantRoles(tx);
    await seedSystemPolicies(tx);
    await seedDefaultPolicies(tx);
    await tx`
      insert into meta (key, value, updated_at)
      values ('schema_hash', ${SCHEMA_HASH}, now())
      on conflict (key) do update
        set value = excluded.value, updated_at = excluded.updated_at`;
  });
}
