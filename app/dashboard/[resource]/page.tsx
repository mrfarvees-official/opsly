import { notFound } from "next/navigation";

import { DataTable, type DataTableRow } from "@/components/data-table";
import { listAudit } from "@/features/platform/application/audit";
import { listBackups } from "@/features/platform/application/backup-service";
import { listPolicies } from "@/features/platform/application/pbac-service";
import { listActions, listResources } from "@/features/platform/application/resource-service";
import { getSettings } from "@/features/platform/application/setting-service";
import { listTeams } from "@/features/platform/application/team-service";
import { listUsers } from "@/features/platform/application/user-service";
import { listRoles } from "@/features/platform/application/role-service";

export const instant = false;

type Row = Record<string, unknown>;

const META: Record<string, { title: string; eyebrow: string; description: string }> = {
  teams: { title: "Teams", eyebrow: "Workspace", description: "Organize people around the work they own." },
  users: { title: "People", eyebrow: "Workspace", description: "Manage members, roles and account access." },
  roles: { title: "Roles", eyebrow: "Workspace access", description: "Create roles and decide what each role can do." },
  policies: { title: "Policies", eyebrow: "Access control", description: "See the rules that decide what each role can do." },
  resources: { title: "Resources", eyebrow: "Access control", description: "The objects available to your workspace policies." },
  actions: { title: "Actions", eyebrow: "Access control", description: "The operations that can be granted and audited." },
  audit: { title: "Audit log", eyebrow: "Workspace history", description: "A record of changes and authorization decisions." },
  backups: { title: "Backups", eyebrow: "Workspace safety", description: "Encrypted snapshots available for recovery." },
  settings: { title: "Settings", eyebrow: "Workspace", description: "Defaults that shape this workspace." },
};

async function loadRows(resource: string): Promise<Row[]> {
  switch (resource) {
    case "teams": return (await listTeams()) as unknown as Row[];
    case "users": return (await listUsers()) as unknown as Row[];
    case "roles": return (await listRoles()) as unknown as Row[];
    case "policies": return (await listPolicies()) as unknown as Row[];
    case "resources": return (await listResources()) as unknown as Row[];
    case "actions": return (await listActions()) as unknown as Row[];
    case "audit": return (await listAudit({ limit: 100 })).items as unknown as Row[];
    case "backups": return (await listBackups()) as unknown as Row[];
    case "settings": {
      const settings = await getSettings();
      return Object.entries(settings).map(([key, value]) => ({ key, value }));
    }
    default: notFound();
  }
}

export default async function DashboardResourcePage({
  params,
}: {
  params: Promise<{ resource: string }>;
}) {
  const { resource } = await params;
  const meta = META[resource];
  if (!meta) notFound();

  const sourceRows = await loadRows(resource);
  const hiddenColumns = new Set(["id", "created_at", "createdAt", ...(resource === "audit" ? ["actor_id", "resource_id", "ip", "user_agent"] : []), ...(resource === "policies" ? ["subjects", "targets", "conditions"] : [])]);
  const rows: DataTableRow[] = sourceRows.map((row) => {
    const formatted = Object.fromEntries(
      Object.entries(row).map(([key, value]) => [key, resource === "audit" ? formatAuditValue(key, value) : formatValue(value)]),
    ) as DataTableRow;
    const id = formatted.id ?? formatted.key;
    if (id && ["teams", "users", "roles", "policies", "resources", "backups"].includes(resource)) {
      const apiResource = resource === "policies" ? "pbac" : resource === "resources" ? "resources" : resource;
      const apiId = resource === "resources" ? id : encodeURIComponent(id);
      if (resource !== "backups") formatted.editHref = `/dashboard/${resource}/${encodeURIComponent(id)}/edit`;
      formatted.deleteEndpoint = `/api/${apiResource}/${apiId}`;
      formatted.viewHref = `/dashboard/${resource}/${encodeURIComponent(id)}`;
    }
    if (resource === "settings" && formatted.key) {
      formatted.viewHref = `/dashboard/settings/${encodeURIComponent(formatted.key)}`;
      formatted.editHref = `/dashboard/settings/${encodeURIComponent(formatted.key)}/edit`;
    }
    if (resource === "actions" && formatted.key) formatted.viewHref = `/dashboard/actions/${encodeURIComponent(formatted.key)}`;
    if (resource === "audit" && formatted.id) formatted.viewHref = `/dashboard/audit/${encodeURIComponent(formatted.id)}`;
    return formatted;
  });
  const columns = rows.length > 0
    ? Object.keys(rows[0]).filter((column) => !hiddenColumns.has(column) && !["viewHref", "editHref", "deleteEndpoint"].includes(column)).slice(0, 6)
    : [];
  const canCreate = ["teams", "users", "roles", "policies", "resources", "backups"].includes(resource);

  return (
    <main className="p-6 sm:p-10">
      <header className="max-w-3xl">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand">{meta.eyebrow}</p>
        <h1 className="mt-2 font-display text-3xl font-bold tracking-tight">{meta.title}</h1>
        <p className="mt-2 text-ink-soft">{meta.description}</p>
      </header>
      <section className="mt-8 overflow-hidden rounded-2xl border border-line bg-card" aria-label={`${meta.title} table`}>
        <DataTable columns={columns} rows={rows} createHref={canCreate ? `/dashboard/${resource}/new` : undefined} />
      </section>
    </main>
  );
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (value instanceof Date) return value.toLocaleString();
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function formatAuditValue(key: string, value: unknown): string {
  if (key === "details") return formatAuditSummary(value);
  if (key === "resource") {
    return ({ user: "People", team: "Teams", role: "Roles", pbac: "Policies", resource: "Resources", action: "Actions", audit: "Audit log", backup: "Backups", setting: "Settings" } as Record<string, string>)[String(value)] ?? formatValue(value);
  }
  if (key === "action") {
    return ({ view: "View details", viewAny: "View list", create: "Create", update: "Edit", delete: "Remove", assign: "Assign", import: "Import", export: "Export", restore: "Restore" } as Record<string, string>)[String(value)] ?? formatValue(value);
  }
  if (key === "outcome") {
    return ({ success: "Completed", failure: "Failed", denied: "Not allowed" } as Record<string, string>)[String(value)] ?? formatValue(value);
  }
  return formatValue(value);
}

function formatAuditSummary(value: unknown): string {
  if (!value || typeof value !== "object") return formatValue(value);
  const details = value as Record<string, unknown>;
  if (typeof details.error === "string") return details.error;
  if (Array.isArray(details.changed)) return `Updated: ${details.changed.map((item) => humanizeLabel(String(item))).join(", ")}`;
  if (typeof details.email === "string" && typeof details.role === "string") return `${humanizeLabel(details.role)} role · ${details.email}`;
  if (typeof details.name === "string") return details.name;
  if (details.policy || details.changes) return "Policy details updated";
  return "Additional event details";
}

function humanizeLabel(value: string) {
  return value.replaceAll("_", " ").replace(/([a-z])([A-Z])/g, "$1 $2").replace(/(^|\s)\S/g, (letter) => letter.toUpperCase());
}
