import Link from "next/link";
import { notFound } from "next/navigation";

import { getPolicy } from "@/features/platform/application/pbac-service";
import { listAudit } from "@/features/platform/application/audit";
import { listBackups } from "@/features/platform/application/backup-service";
import { listActions, listResources } from "@/features/platform/application/resource-service";
import { getSettings } from "@/features/platform/application/setting-service";
import { getTeam } from "@/features/platform/application/team-service";
import { getUser } from "@/features/platform/application/user-service";
import { listRoles } from "@/features/platform/application/role-service";

export const instant = false;

export default async function DashboardRecordPage({
  params,
}: {
  params: Promise<{ resource: string; id: string }>;
}) {
  const { resource, id } = await params;
  if (resource === "policies") {
    const policy = await getPolicy(id);
    return <PolicyDetail policy={policy} id={id} />;
  }

  const record = await loadRecord(resource, id);
  if (!record) notFound();

  if (resource === "audit") return <AuditDetail record={record} />;

  return (
    <main className="p-6 sm:p-10">
      <Link href={`/dashboard/${resource}`} className="text-sm font-semibold text-brand hover:text-brand-dark">← Back to {resource}</Link>
      <div className="mt-6"><p className="text-xs font-bold uppercase tracking-[0.18em] text-brand">Record detail</p><h1 className="mt-2 font-display text-3xl font-bold tracking-tight">{String(record.name ?? record.email ?? record.key ?? record.id ?? "Record")}</h1></div>
      <section className="mt-8 rounded-2xl border border-line bg-card p-6"><dl className="grid gap-5 sm:grid-cols-2">{Object.entries(record).filter(([key]) => key !== "id" && key !== "created_at" && key !== "createdAt").map(([key, value]) => <div key={key}><dt className="text-sm text-ink-soft">{formatLabel(key)}</dt><dd className="mt-1 break-words font-medium">{formatValue(value)}</dd></div>)}</dl></section>
    </main>
  );
}

async function loadRecord(resource: string, id: string): Promise<Record<string, unknown> | null> {
  if (resource === "teams") return (await getTeam(id)) as unknown as Record<string, unknown>;
  if (resource === "users") return (await getUser(id)) as unknown as Record<string, unknown>;
  if (resource === "roles") return ((await listRoles()) as unknown as Record<string, unknown>[]).find((row) => row.key === id) ?? null;
  if (resource === "resources") return ((await listResources()) as unknown as Record<string, unknown>[]).find((row) => row.key === id) ?? null;
  if (resource === "actions") return ((await listActions()) as unknown as Record<string, unknown>[]).find((row) => row.key === id) ?? null;
  if (resource === "backups") return ((await listBackups()) as unknown as Record<string, unknown>[]).find((row) => row.id === id) ?? null;
  if (resource === "audit") return (await listAudit({ limit: 200 })).items.find((row) => row.id === id) as unknown as Record<string, unknown> ?? null;
  if (resource === "settings") {
    const settings = await getSettings();
    return id in settings ? { key: id, value: settings[id] } : null;
  }
  return null;
}

function PolicyDetail({ policy, id }: { policy: Awaited<ReturnType<typeof getPolicy>>; id: string }) {
  return (
    <main className="p-6 sm:p-10">
      <Link href="/dashboard/policies" className="text-sm font-semibold text-brand hover:text-brand-dark">← Back to policies</Link>
      <div className="mt-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand">Policy detail</p>
          <h1 className="mt-2 font-display text-3xl font-bold tracking-tight">{policy.name}</h1>
          <p className="mt-2 text-ink-soft">{policy.description ?? "No description provided."}</p>
        </div>
        <Link href={`/dashboard/policies/${id}/edit`} className="rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark">Edit policy</Link>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <Summary label="What happens" value={policy.effect === "allow" ? "Allow access" : "Block access"} />
        <Summary label="Status" value={policy.enabled ? "Enabled" : "Disabled"} />
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-3">
        <ReadableSection title="Who this applies to" items={policy.subjects.map(describeSubject)} empty="Everyone" />
        <ReadableSection title="What they can access" items={policy.targets.map(describeTarget)} empty="Nothing selected" />
        <ReadableSection title="When this applies" items={policy.conditions.map(describeCondition)} empty="Always" />
      </div>
    </main>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl border border-line bg-card p-5"><p className="text-sm text-ink-soft">{label}</p><p className="mt-2 truncate font-semibold">{value}</p></div>;
}

function AuditDetail({ record }: { record: Record<string, unknown> }) {
  const details = isObject(record.details) ? record.details : {};
  const changes = isObject(details.changes) ? details.changes : {};
  const changeRows = Object.entries(changes).filter(([, value]) => isObject(value));
  const detailRows = flattenAuditDetails(details).filter(([key]) => key !== "changes" && !key.startsWith("changes."));
  const resource = readableAuditResource(record.resource);
  const action = readableAuditAction(record.action);

  return (
    <main className="p-6 sm:p-10">
      <Link href="/dashboard/audit" className="text-sm font-semibold text-brand hover:text-brand-dark">← Back to audit log</Link>
      <div className="mt-6">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand">Audit event</p>
        <h1 className="mt-2 font-display text-3xl font-bold tracking-tight">{action} {resource}</h1>
        <p className="mt-2 text-ink-soft">A record of what changed in your workspace.</p>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <Summary label="Person" value={String(record.actor_email ?? "Unknown person")} />
        <Summary label="Result" value={readableOutcome(record.outcome)} />
        <Summary label="Area" value={resource} />
      </div>

      <section className="mt-6 overflow-hidden rounded-2xl border border-line bg-card">
        <div className="border-b border-line px-5 py-4"><h2 className="font-display text-lg font-semibold">Before and after</h2><p className="mt-1 text-sm text-ink-soft">The values recorded before and after this change.</p></div>
        {changeRows.length > 0 ? <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-paper text-ink-soft"><tr><th className="px-5 py-3 font-semibold">What changed</th><th className="px-5 py-3 font-semibold">Before</th><th className="px-5 py-3 font-semibold">After</th></tr></thead><tbody>{changeRows.map(([key, value]) => <tr key={key} className="border-t border-line"><td className="px-5 py-4 font-semibold">{humanizeLabel(key)}</td><td className="px-5 py-4 text-ink-soft">{formatAuditDetail(isObject(value) ? value.from : undefined)}</td><td className="px-5 py-4 font-medium">{formatAuditDetail(isObject(value) ? value.to : undefined)}</td></tr>)}</tbody></table></div> : <p className="px-5 py-6 text-sm text-ink-soft">This event does not contain before-and-after values.</p>}
      </section>

      {detailRows.length > 0 && <section className="mt-6 overflow-hidden rounded-2xl border border-line bg-card"><div className="border-b border-line px-5 py-4"><h2 className="font-display text-lg font-semibold">Event details</h2><p className="mt-1 text-sm text-ink-soft">All additional information recorded for this event.</p></div><div className="divide-y divide-line">{detailRows.map(([key, value]) => <div key={key} className="grid gap-1 px-5 py-4 sm:grid-cols-[220px_1fr] sm:gap-5"><p className="text-sm font-semibold text-ink-soft">{humanizeLabel(key)}</p><p className="break-words text-sm font-medium">{formatAuditDetail(value, key)}</p></div>)}</div></section>}
    </main>
  );
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function flattenAuditDetails(value: unknown, prefix = ""): [string, unknown][] {
  if (!isObject(value)) return prefix ? [[prefix, value]] : [];
  return Object.entries(value).flatMap(([key, nested]) => {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (isTechnicalAuditKey(key)) return [];
    if (Array.isArray(nested)) {
      return nested.flatMap((item, index) => flattenAuditDetails(item, `${fullKey} ${index + 1}`));
    }
    if (isObject(nested)) return flattenAuditDetails(nested, fullKey);
    return [[fullKey, nested]] as [string, unknown][];
  });
}

function formatAuditDetail(value: unknown, key = "") {
  if (value === undefined || value === null || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "object") return "Updated details";
  if (key.toLowerCase().includes("effect")) return value === "allow" ? "Allow access" : value === "deny" ? "Block access" : String(value);
  if (key.toLowerCase().includes("role")) return humanizeLabel(String(value));
  if (key.toLowerCase().includes("action")) return readableAuditAction(value);
  if (key.toLowerCase().includes("resource")) return readableAuditResource(value);
  return String(value);
}

function isTechnicalAuditKey(key: string) {
  return /(^|_)(id|ip|useragent|user_agent)$/i.test(key) || key === "resourceId" || key === "actorId";
}

function humanizeLabel(value: string) {
  return value.replaceAll("_", " ").replace(/([a-z])([A-Z])/g, "$1 $2").replace(/(^|\s)\S/g, (letter) => letter.toUpperCase());
}

function readableAuditResource(value: unknown) {
  return ({ user: "People", team: "Teams", role: "Roles", pbac: "Policies", resource: "Resources", action: "Actions", audit: "Audit log", backup: "Backups", setting: "Settings" } as Record<string, string>)[String(value)] ?? humanizeLabel(String(value ?? "Workspace"));
}

function readableAuditAction(value: unknown) {
  return ({ view: "Viewed", viewAny: "Viewed", create: "Created", update: "Edited", delete: "Removed", assign: "Assigned", import: "Imported", export: "Exported", restore: "Restored" } as Record<string, string>)[String(value)] ?? humanizeLabel(String(value ?? "Changed"));
}

function readableOutcome(value: unknown) {
  return ({ success: "Completed", failure: "Failed", denied: "Not allowed" } as Record<string, string>)[String(value)] ?? "Recorded";
}

function ReadableSection({
  title,
  items,
  empty,
}: {
  title: string;
  items: string[];
  empty: string;
}) {
  return (
    <section className="rounded-2xl border border-line bg-card p-5">
      <h2 className="font-display text-lg font-semibold">{title}</h2>
      <ul className="mt-4 space-y-3">
        {(items.length ? items : [empty]).map((item) => (
          <li key={item} className="rounded-xl bg-paper px-4 py-3 text-sm leading-6 text-ink-soft">
            {item}
          </li>
        ))}
      </ul>
    </section>
  );
}

function describeSubject(subject: { kind: string; value: unknown }) {
  if (subject.kind === "everyone") return "Everyone in the workspace";
  if (subject.kind === "role") return `People with the ${humanize(String(subject.value))} role`;
  if (subject.kind === "team") return "Members of a selected team";
  return "A selected person";
}

function describeTarget(target: { resource: string; action: string; resourceId: string | null }) {
  const resource = target.resource === "*" ? "all workspace areas" : humanize(target.resource);
  const action = target.action === "*" ? "any action" : humanize(target.action);
  return `Can ${action.toLowerCase()} in ${resource.toLowerCase()}`;
}

function describeCondition(condition: {
  attribute: string;
  operator: string;
  value: unknown;
  valueIsAttribute: boolean;
}) {
  const attribute = humanizeAttribute(condition.attribute);
  const value = condition.valueIsAttribute
    ? humanizeAttribute(String(condition.value))
    : formatConditionValue(condition.value);
  return `${attribute} ${humanizeOperator(condition.operator)} ${value}`;
}

function humanizeAttribute(attribute: string) {
  const labels: Record<string, string> = {
    "subject.userId": "Person",
    "subject.role": "Person's role",
    "subject.teamId": "Person's team",
    "target.resource": "Workspace area",
    "target.action": "Requested action",
    "target.resourceId": "Selected record",
    "env.hour": "Current hour",
  };
  return labels[attribute] ?? humanize(attribute.replaceAll(".", " "));
}

function humanizeOperator(operator: string) {
  return ({
    eq: "is",
    neq: "is not",
    in: "is one of",
    notIn: "is not one of",
    contains: "contains",
    gt: "is greater than",
    gte: "is at least",
    lt: "is less than",
    lte: "is at most",
  } as Record<string, string>)[operator] ?? humanize(operator);
}

function formatConditionValue(value: unknown) {
  if (Array.isArray(value)) return value.map((item) => humanize(String(item))).join(", ");
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (value === null || value === undefined) return "nothing";
  return `“${humanize(String(value))}”`;
}

function humanize(value: string) {
  return value
    .replaceAll("_", " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/(^|\s)\S/g, (letter) => letter.toUpperCase());
}

function formatLabel(value: string) {
  return value.replaceAll("_", " ").replace(/(^|\s)\S/g, (letter) => letter.toUpperCase());
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (value instanceof Date) return value.toLocaleString();
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}
