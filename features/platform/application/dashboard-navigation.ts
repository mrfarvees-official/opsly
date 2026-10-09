import "server-only";

import { connection } from "next/server";

import { getTenantSql } from "../infrastructure/tenant-sql";

import { loadPolicies } from "./authorize";
import { getContext } from "./context";
import { decide, type Policy } from "./pbac-engine";
import { getTenantRole } from "./tenant-role-membership";

export interface DashboardNavItem {
  label: string;
  href: string;
  resource: string;
  description: string;
}

const NAV_ITEMS: readonly DashboardNavItem[] = [
  { label: "Teams", href: "/dashboard/teams", resource: "team", description: "Groups, members and ownership" },
  { label: "People", href: "/dashboard/users", resource: "user", description: "Workspace members and roles" },
  { label: "Roles", href: "/dashboard/roles", resource: "role", description: "Workspace roles and permissions" },
  { label: "Policies", href: "/dashboard/policies", resource: "pbac", description: "Access rules and decisions" },
  { label: "Resources", href: "/dashboard/resources", resource: "resource", description: "Objects available to your workspace" },
  { label: "Actions", href: "/dashboard/actions", resource: "action", description: "Permission actions and audit behavior" },
  { label: "Audit log", href: "/dashboard/audit", resource: "audit", description: "A trace of workspace changes" },
  { label: "Backups", href: "/dashboard/backups", resource: "backup", description: "Encrypted workspace snapshots" },
];

async function getDashboardSubject() {
  const ctx = await getContext();
  const sql = await getTenantSql(ctx.tenantId);
  const teams = await sql<{ team_id: string }[]>`
    select m.team_id from team_member m
    join team t on t.id = m.team_id
    where m.user_id = ${ctx.userId} and t.deleted_at is null`;

  return {
    sql,
    ctx,
    subject: { ...ctx, role: await getTenantRole(sql, ctx.userId, ctx.role), teamIds: teams.map((team) => team.team_id).join(",") },
  };
}

function visibleItems(policies: Policy[], subject: Parameters<typeof decide>[1]) {
  if (subject.role === "owner") return NAV_ITEMS;

  return NAV_ITEMS.filter((item) =>
    decide(policies, subject, { resource: item.resource, action: "viewAny" }).allowed,
  );
}

export async function getDashboardNavigation() {
  await connection();
  const { sql, ctx, subject } = await getDashboardSubject();
  const policies = await loadPolicies(sql, true);

  return {
    items: visibleItems(policies, subject),
    user: { id: ctx.userId, email: ctx.email, role: ctx.role },
  };
}
