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
  { label: "Business designer", href: "/dashboard/designer", resource: "business_definition", description: "Design data, dependencies and snapshots" },
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
  // Keep development tenants created before migration 8 usable while the
  // normal tenant migration runner catches up.
  await sql.unsafe(`alter table resource add column if not exists requires_explicit_policy boolean not null default false`);
  const policies = await loadPolicies(sql, true);
  const customItems = await sql<{ key: string; name: string; route_path: string; description: string | null; requires_explicit_policy: boolean; has_explicit_view_policy: boolean }[]>`
    select key, name, route_path, description, requires_explicit_policy,
      exists (select 1 from pbac_target target where target.resource = resource.key and target.action in ('viewAny', 'view', '*')) as has_explicit_view_policy
    from resource
    where sidebar_visible = true and route_path is not null
    order by sidebar_order, name`;
  const allItems = [
    ...NAV_ITEMS,
    ...customItems
      .filter((item) => !NAV_ITEMS.some((nav) => nav.resource === item.key))
      .filter((item) => subject.role === "owner" || !item.requires_explicit_policy || item.has_explicit_view_policy)
      .map((item) => ({ label: item.name, href: item.route_path, resource: item.key, description: item.description ?? item.name })),
  ];
  const visibleCustomItems = allItems.filter((item) => !NAV_ITEMS.some((nav) => nav.resource === item.resource) && (subject.role === "owner" || decide(policies, subject, { resource: item.resource, action: "viewAny" }).allowed));
  const businessItems = visibleCustomItems.filter((item) => item.href.startsWith("/dashboard/data/"));
  const otherCustomItems = visibleCustomItems.filter((item) => !item.href.startsWith("/dashboard/data/"));

  return {
    items: businessItems.concat(visibleItems(policies, subject), otherCustomItems),
    user: { id: ctx.userId, email: ctx.email, role: ctx.role },
  };
}
