import { notFound } from "next/navigation";

import { ResourceForm } from "@/components/resource-form";
import { listResources } from "@/features/platform/application/resource-service";
import { listRoles } from "@/features/platform/application/role-service";

export const instant = false;

const CREATABLE = new Set(["teams", "users", "roles", "policies", "resources", "backups"]);

export default async function NewResourcePage({
  params,
}: {
  params: Promise<{ resource: string }>;
}) {
  const { resource } = await params;
  if (!CREATABLE.has(resource)) notFound();
  const resourceOptions = resource === "policies" ? (await listResources()).map((item) => ({ key: item.key, name: item.name })) : [];
  const roleOptions = resource === "users" || resource === "policies" ? (await listRoles()).map((item) => ({ key: item.key, name: item.name })) : [];
  return <main className="p-6 sm:p-10"><p className="text-xs font-bold uppercase tracking-[0.18em] text-brand">Workspace</p><h1 className="mt-2 font-display text-3xl font-bold">Create {resource === "users" ? "person" : resource.slice(0, -1)}</h1><p className="mt-2 mb-8 text-ink-soft">Add a new record to this workspace.</p><ResourceForm resource={resource} mode="create" resourceOptions={resourceOptions} roleOptions={roleOptions} /></main>;
}
