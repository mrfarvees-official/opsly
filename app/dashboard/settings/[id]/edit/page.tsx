import { notFound } from "next/navigation";

import { ResourceForm } from "@/components/resource-form";
import { getSettings } from "@/features/platform/application/setting-service";

export const instant = false;

export default async function EditSettingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const settings = await getSettings();
  if (!(id in settings)) notFound();

  return (
    <main className="p-6 sm:p-10">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand">Workspace settings</p>
      <h1 className="mt-2 font-display text-3xl font-bold">Edit setting</h1>
      <p className="mt-2 mb-8 text-ink-soft">Update the value used by this workspace.</p>
      <ResourceForm resource="settings" mode="edit" id={id} initial={{ key: id, value: settings[id] }} />
    </main>
  );
}
