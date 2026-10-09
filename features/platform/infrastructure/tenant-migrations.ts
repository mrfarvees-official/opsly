/**
 * Append-only tenant migrations. IDs must stay strictly increasing. Never
 * edit or delete a shipped migration; the baseline DDL in tenant-sql.ts is
 * frozen and all later tenant schema changes belong here.
 */
export interface TenantMigration {
  id: number;
  name: string;
  sql: string;
}

export const MIGRATIONS: TenantMigration[] = [
  {
    id: 1,
    name: "add tenant roles and role assignments",
    sql: `
      create table if not exists workspace_role (
        id uuid primary key default gen_random_uuid(),
        key text not null unique,
        name text not null,
        description text,
        system boolean not null default false,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      );
      create table if not exists workspace_role_member (
        user_id uuid primary key,
        role_id uuid not null references workspace_role(id) on delete restrict,
        assigned_by uuid,
        assigned_at timestamptz not null default now()
      );
      create index if not exists workspace_role_member_role on workspace_role_member (role_id);
    `,
  },
];
