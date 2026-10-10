import Link from "next/link";
import { notFound } from "next/navigation";

import { getBusinessRecord } from "@/features/platform/application/business-designer-service";

export const instant = false;

export default async function BusinessRecordPage({ params }: { params: Promise<{ resource: string; id: string }> }) {
  const { resource, id } = await params;
  const record = await getBusinessRecord(resource, id).catch(() => null);
  if (!record) notFound();
  const fields = record.fields.filter((field: { sensitive?: boolean }) => !field.sensitive);
  return <main className="p-6 sm:p-10"><Link href={`/dashboard/data/${resource}`} className="text-sm font-semibold text-brand">← Back to {record.name}</Link><header className="mt-6"><p className="text-xs font-bold uppercase tracking-[0.18em] text-brand">Record details</p><h1 className="mt-2 font-display text-3xl font-bold">{record.name}</h1><p className="mt-2 text-sm text-ink-soft">Record {id}</p></header><section className="mt-8 grid gap-4 sm:grid-cols-2">{fields.map((field: { key: string; label?: string; description?: string }) => <div key={field.key} className="rounded-2xl border border-line bg-card p-5"><p className="text-xs font-bold uppercase tracking-wide text-ink-soft">{field.label ?? field.key}</p><p className="mt-2 break-words text-sm">{formatValue(record.row[field.key])}</p>{field.description && <p className="mt-2 text-xs text-ink-soft">{field.description}</p>}</div>)}</section></main>;
}

function formatValue(value: unknown) { return value === null || value === undefined || value === "" ? "—" : typeof value === "object" ? JSON.stringify(value) : String(value); }
