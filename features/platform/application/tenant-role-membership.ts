import "server-only";

import type { Sql, TransactionSql } from "postgres";

type TenantSql = Sql | TransactionSql;

export async function getTenantRole(
  sql: TenantSql,
  userId: string,
  fallback: string,
): Promise<string> {
  if (fallback === "owner") return fallback;
  const [row] = await sql<{ key: string }[]>`
    select r.key
    from workspace_role_member m
    join workspace_role r on r.id = m.role_id
    where m.user_id = ${userId}`;
  return row?.key ?? fallback;
}

export async function listTenantRoleAssignments(sql: TenantSql) {
  return sql<{ user_id: string; role: string }[]>`
    select m.user_id, r.key as role
    from workspace_role_member m
    join workspace_role r on r.id = m.role_id`;
}

export async function tenantRoleExists(sql: TenantSql, key: string) {
  const [row] = await sql<{ id: string }[]>`
    select id from workspace_role where key = ${key}`;
  return Boolean(row);
}

export async function assignTenantRole(
  sql: TenantSql,
  userId: string,
  roleKey: string,
  assignedBy: string,
) {
  const [role] = await sql<{ id: string }[]>`
    select id from workspace_role where key = ${roleKey}`;
  if (!role) throw new Error(`Role ${roleKey} does not exist.`);
  await sql`
    insert into workspace_role_member (user_id, role_id, assigned_by)
    values (${userId}, ${role.id}, ${assignedBy})
    on conflict (user_id) do update
      set role_id = excluded.role_id,
          assigned_by = excluded.assigned_by,
          assigned_at = now()`;
}
