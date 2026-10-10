import { notFound } from "next/navigation";

import { BusinessResourceView } from "@/components/business-resource-view";
import { listBusinessTableRows } from "@/features/platform/application/business-designer-service";

export const instant = false;

export default async function BusinessTablePage({ params }: { params: Promise<{ resource: string }> }) {
  const { resource } = await params;
  const table = await listBusinessTableRows(resource).catch(() => null);
  if (!table) notFound();
  return <main className="p-6 sm:p-10"><header><p className="text-xs font-bold uppercase tracking-[0.18em] text-brand">Business resource</p><h1 className="mt-2 font-display text-3xl font-bold tracking-tight">{table.name}</h1><p className="mt-2 text-ink-soft">Manage records with the rules and relationships defined for this resource.</p></header><BusinessResourceView resource={resource} initial={table} /></main>;
}
