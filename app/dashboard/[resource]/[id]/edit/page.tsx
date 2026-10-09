import { notFound } from "next/navigation";

import { ResourceForm } from "@/components/resource-form";
import { getPolicy } from "@/features/platform/application/pbac-service";
import { getTeam } from "@/features/platform/application/team-service";
import { getUser } from "@/features/platform/application/user-service";
import { listResources } from "@/features/platform/application/resource-service";
import { listRoles } from "@/features/platform/application/role-service";

export const instant = false;

export default async function EditResourcePage({
  params,
}: {
  params: Promise<{ resource: string; id: string }>;
}) {
  const { resource, id } = await params;
  let initial: Record<string, unknown>;
  let resourceOptions: { key: string; name: string }[] = [];
  let roleOptions: { key: string; name: string }[] = [];
  if (resource === "policies") {
    const [policy, resources] = await Promise.all([getPolicy(id), listResources()]);
    initial = policy as unknown as Record<string, unknown>;
    resourceOptions = resources.map((item) => ({ key: item.key, name: item.name }));
    roleOptions = (await listRoles()).map((item) => ({ key: item.key, name: item.name }));
  }
  else if (resource === "teams") initial = (await getTeam(id)) as unknown as Record<string, unknown>;
  else if (resource === "users") {
    const [user, roles] = await Promise.all([getUser(id), listRoles()]);
    initial = user as unknown as Record<string, unknown>;
    roleOptions = roles.map((item) => ({ key: item.key, name: item.name }));
  }
  else if (resource === "roles") {
    const role = (await listRoles()).find((item) => item.key === id);
    if (!role) notFound();
    initial = role as unknown as Record<string, unknown>;
  }
  else if (resource === "resources") {
    const resourceRow = (await listResources()).find((row) => row.key === id);
    if (!resourceRow) notFound();
    initial = resourceRow as unknown as Record<string, unknown>;
  } else notFound();

  return <main className="min-h-[calc(100vh-3rem)] p-6 sm:p-10"><p className="text-xs font-bold uppercase tracking-[0.18em] text-brand">Workspace</p><h1 className="mt-2 font-display text-3xl font-bold">Edit {resource === "users" ? "person" : resource.slice(0, -1)}</h1><p className="mt-2 mb-8 text-ink-soft">Update this record and save the changes.</p><ResourceForm resource={resource} mode="edit" id={id} initial={initial} resourceOptions={resourceOptions} roleOptions={roleOptions} /></main>;
}
