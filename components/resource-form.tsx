"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Policy = {
  id?: string;
  name: string;
  description: string | null;
  effect: "allow" | "deny";
  enabled: boolean;
  subjects: { kind: string; value: string | null }[];
  targets: { resource: string; action: string; resourceId: string | null }[];
  conditions: { attribute: string; operator: string; value: unknown; valueIsAttribute: boolean }[];
};

type ResourceOption = { key: string; name: string };

export function ResourceForm({
  resource,
  mode,
  id,
  initial,
  resourceOptions = [],
  roleOptions = [],
}: {
  resource: string;
  mode: "create" | "edit";
  id?: string;
  initial?: Record<string, unknown>;
  resourceOptions?: ResourceOption[];
  roleOptions?: ResourceOption[];
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState(String(initial?.name ?? ""));
  const [description, setDescription] = useState(String(initial?.description ?? ""));
  const [email, setEmail] = useState(String(initial?.email ?? ""));
  const [password, setPassword] = useState("");
  const [role, setRole] = useState(String(initial?.role ?? "member"));
  const [key, setKey] = useState(String(initial?.key ?? ""));
  const [settingValue, setSettingValue] = useState(String(initial?.value ?? ""));
  const [policy, setPolicy] = useState<Policy>(() => toPolicy(initial));
  const [backupSaving, setBackupSaving] = useState(false);

  if (resource === "backups") {
    return <BackupCreator saving={backupSaving} onCreate={async () => { setBackupSaving(true); const response = await fetch("/api/backups", { method: "POST" }); setBackupSaving(false); if (!response.ok) { setError("The backup could not be created."); return; } router.push("/dashboard/backups"); router.refresh(); }} error={error} />;
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    let body: unknown;
    if (resource === "policies") body = policy;
    else if (resource === "settings") body = { [key]: parseSettingValue(settingValue) };
    else if (resource === "users") body = { email, password: password || undefined, role };
    else if (resource === "resources" || resource === "roles") body = { key, name, description };
    else body = { name, description };

    const endpoint = resource === "settings" ? "/api/settings" : mode === "create"
      ? `/api/${resource === "policies" ? "pbac" : resource}`
      : `/api/${resource === "policies" ? "pbac" : resource}/${encodeURIComponent(id ?? key)}`;
    const method = resource === "settings" ? "PATCH" : mode === "create" ? "POST" : resource === "policies" ? "PUT" : "PATCH";
    const response = await fetch(endpoint, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    if (!response.ok) {
      const result = await response.json().catch(() => null);
      setError(result?.error ?? "The record could not be saved.");
      setSaving(false);
      return;
    }
    router.push(`/dashboard/${resource}`);
    router.refresh();
  }

  const title = mode === "create" ? `Create ${labelFor(resource)}` : `Edit ${labelFor(resource)}`;
  return (
    <form onSubmit={submit} className={`resource-form ${resource === "policies" ? "w-full max-w-none" : "max-w-5xl"} rounded-2xl border border-line bg-card p-6 sm:p-8`}>
      <div className="grid gap-5">
        {resource === "policies" ? <PolicyFields policy={policy} setPolicy={setPolicy} resourceOptions={resourceOptions} roleOptions={roleOptions} /> : <>
          {resource === "users" && <Field label="Email"><input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></Field>}
          {resource === "users" && <Field label={mode === "create" ? "Temporary password" : "New password (optional)"}><input required={mode === "create"} type="password" value={password} onChange={(event) => setPassword(event.target.value)} /></Field>}
          {resource === "users" && <Field label="Role"><select value={role} onChange={(event) => setRole(event.target.value)}>{roleOptions.length ? roleOptions.map((option) => <option key={option.key} value={option.key}>{option.name}</option>) : <><option value="member">Member</option><option value="admin">Administrator</option></>}</select></Field>}
          {(resource === "resources" || resource === "roles") && <Field label={resource === "roles" ? "Role key" : "Resource key"}><input required disabled={mode === "edit"} value={key} onChange={(event) => setKey(event.target.value)} placeholder={resource === "roles" ? "support_lead" : "vendor_contract"} /></Field>}
          {resource !== "users" && resource !== "settings" && <Field label="Name"><input required value={name} onChange={(event) => setName(event.target.value)} /></Field>}
          {resource !== "users" && resource !== "settings" && <Field label="Description"><textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={4} /></Field>}
          {resource === "settings" && <Field label="Value"><input required value={settingValue} onChange={(event) => setSettingValue(event.target.value)} /></Field>}
        </>}
      </div>
      {error && <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-bad" role="alert">{error}</p>}
      <div className="mt-6 flex gap-3"><button type="submit" disabled={saving} className="rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-50">{saving ? "Saving…" : mode === "create" ? "Create" : "Save changes"}</button><button type="button" onClick={() => router.back()} className="rounded-xl border border-line px-4 py-2.5 text-sm font-semibold hover:border-brand">Cancel</button></div>
      <h1 className="sr-only">{title}</h1>
    </form>
  );
}

function PolicyFields({ policy, setPolicy, resourceOptions, roleOptions }: { policy: Policy; setPolicy: (value: Policy) => void; resourceOptions: ResourceOption[]; roleOptions: ResourceOption[] }) {
  const update = (changes: Partial<Policy>) => setPolicy({ ...policy, ...changes });
  return <>
    <div className="grid gap-5 xl:grid-cols-12">
      <div className="xl:col-span-7"><Field label="Policy name"><input required value={policy.name} onChange={(event) => update({ name: event.target.value })} /></Field></div>
      <div className="xl:col-span-5"><Field label="Description"><input value={policy.description ?? ""} onChange={(event) => update({ description: event.target.value })} placeholder="Explain this rule in a few words" /></Field></div>
      <div className="xl:col-span-3"><Field label="Decision"><select value={policy.effect} onChange={(event) => update({ effect: event.target.value as Policy["effect"] })}><option value="allow">Allow</option><option value="deny">Deny</option></select></Field></div>
      <div className="xl:col-span-3"><Field label="Status"><select value={String(policy.enabled)} onChange={(event) => update({ enabled: event.target.value === "true" })}><option value="true">Enabled</option><option value="false">Disabled</option></select></Field></div>
    </div>
    <div className="grid gap-5">
      <div className="rounded-2xl border border-line bg-paper p-5"><div className="flex items-center justify-between gap-3"><h2 className="font-display font-semibold">Who does this apply to?</h2><button type="button" onClick={() => update({ subjects: [...policy.subjects, { kind: "role", value: roleOptions[0]?.key ?? "member" }] })} className="text-xs font-semibold text-brand hover:text-brand-dark">+ Add person or group</button></div><div className="mt-4 grid gap-3">{policy.subjects.map((subject, index) => <SubjectRow key={index} subject={subject} roleOptions={roleOptions} onChange={(next) => update({ subjects: policy.subjects.map((item, itemIndex) => itemIndex === index ? next : item) })} onRemove={() => update({ subjects: policy.subjects.filter((_, itemIndex) => itemIndex !== index) })} canRemove={policy.subjects.length > 1} />)}</div></div>
      <div className="rounded-2xl border border-line bg-paper p-5"><div className="flex items-center justify-between gap-3"><h2 className="font-display font-semibold">What can they access?</h2><button type="button" onClick={() => update({ targets: [...policy.targets, { resource: "*", action: "viewAny", resourceId: null }] })} className="text-xs font-semibold text-brand hover:text-brand-dark">+ Add access</button></div><div className="mt-4 grid gap-3">{policy.targets.map((target, index) => <TargetRow key={index} target={target} resourceOptions={resourceOptions} onChange={(next) => update({ targets: policy.targets.map((item, itemIndex) => itemIndex === index ? next : item) })} onRemove={() => update({ targets: policy.targets.filter((_, itemIndex) => itemIndex !== index) })} canRemove={policy.targets.length > 1} />)}</div></div>
      <div className="rounded-2xl border border-line bg-paper p-5"><div className="flex items-center justify-between gap-3"><h2 className="font-display font-semibold">When does this apply?</h2><button type="button" onClick={() => update({ conditions: [...policy.conditions, { attribute: "subject.email", operator: "eq", value: "", valueIsAttribute: false }] })} className="text-xs font-semibold text-brand hover:text-brand-dark">+ Add condition</button></div><p className="mt-1 text-sm text-ink-soft">Optional rules that narrow access.</p><div className="mt-4 grid gap-3">{policy.conditions.length === 0 ? <p className="rounded-xl bg-card px-3 py-3 text-sm text-ink-soft">No conditions. This rule always applies to the selected people and access.</p> : policy.conditions.map((condition, index) => <ConditionRow key={index} condition={condition} resourceOptions={resourceOptions} onChange={(next) => update({ conditions: policy.conditions.map((item, itemIndex) => itemIndex === index ? next : item) })} onRemove={() => update({ conditions: policy.conditions.filter((_, itemIndex) => itemIndex !== index) })} />)}</div></div>
    </div>
  </>;
}

function SubjectRow({ subject, roleOptions, onChange, onRemove, canRemove }: { subject: Policy["subjects"][number]; roleOptions: ResourceOption[]; onChange: (value: Policy["subjects"][number]) => void; onRemove: () => void; canRemove: boolean }) {
  const roles = roleOptions.length ? roleOptions : [{ key: "member", name: "Member" }, { key: "admin", name: "Administrator" }, { key: "owner", name: "Workspace owner" }];
  return <div className="rounded-xl border border-line bg-card p-3"><div className="flex items-end gap-2"><div className="min-w-0 flex-1"><Field label="Person type"><select value={subject.kind} onChange={(event) => onChange({ ...subject, kind: event.target.value, value: event.target.value === "role" ? roles[0].key : event.target.value === "everyone" ? null : "" })}><option value="everyone">Everyone</option><option value="role">Role</option><option value="user">Specific person</option><option value="team">Team</option></select></Field></div>{canRemove && <RemoveButton onClick={onRemove} />}</div>{subject.kind === "role" && <div className="mt-3"><Field label="Role"><select required value={subject.value ?? ""} onChange={(event) => onChange({ ...subject, value: event.target.value })}>{roles.map((role) => <option key={role.key} value={role.key}>{role.name}</option>)}</select></Field></div>}{subject.kind === "user" && <div className="mt-3"><Field label="Person reference"><input required value={subject.value ?? ""} onChange={(event) => onChange({ ...subject, value: event.target.value })} /></Field></div>}{subject.kind === "team" && <div className="mt-3"><Field label="Team reference"><input required value={subject.value ?? ""} onChange={(event) => onChange({ ...subject, value: event.target.value })} /></Field></div>}</div>;
}

function TargetRow({ target, resourceOptions, onChange, onRemove, canRemove }: { target: Policy["targets"][number]; resourceOptions: ResourceOption[]; onChange: (value: Policy["targets"][number]) => void; onRemove: () => void; canRemove: boolean }) {
  const options = [{ key: "*", name: "All workspace areas" }, ...resourceOptions.filter((option) => option.key !== "*")];
  if (target.resource !== "*" && !options.some((option) => option.key === target.resource)) options.push({ key: target.resource, name: target.resource });
  return <div className="rounded-xl border border-line bg-card p-4"><div className="grid items-end gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]"><Field label="Workspace area"><select value={target.resource} onChange={(event) => onChange({ ...target, resource: event.target.value })}>{options.map((option) => <option key={option.key} value={option.key}>{option.name}</option>)}</select></Field><Field label="What can they do?"><select value={target.action} onChange={(event) => onChange({ ...target, action: event.target.value })}><option value="*">Anything</option><option value="viewAny">View lists</option><option value="view">View details</option><option value="create">Create</option><option value="update">Edit</option><option value="delete">Delete</option><option value="assign">Assign</option><option value="export">Export</option><option value="restore">Restore</option></select></Field>{canRemove && <RemoveButton onClick={onRemove} />}</div></div>;
}

function ConditionRow({ condition, resourceOptions, onChange, onRemove }: { condition: Policy["conditions"][number]; resourceOptions: ResourceOption[]; onChange: (value: Policy["conditions"][number]) => void; onRemove: () => void }) {
  return <div className="rounded-xl border border-line bg-card p-3"><div className="flex items-end gap-2"><div className="min-w-0 flex-1"><Field label="Condition field"><select value={condition.attribute} onChange={(event) => onChange({ ...condition, attribute: event.target.value, value: "", valueIsAttribute: false })}><option value="subject.email">Person email</option><option value="subject.role">Person role</option><option value="target.resource">Requested area</option><option value="target.action">Requested action</option><option value="env.hour">Current hour</option><option value="env.weekday">Day of week</option></select></Field></div><RemoveButton onClick={onRemove} /></div><div className="mt-3 grid gap-3 sm:grid-cols-2"><Field label="Comparison"><select value={condition.operator} onChange={(event) => onChange({ ...condition, operator: event.target.value })}><option value="eq">Is</option><option value="neq">Is not</option><option value="contains">Contains</option><option value="gt">Is greater than</option><option value="gte">Is at least</option><option value="lt">Is less than</option><option value="lte">Is at most</option></select></Field><ConditionValue condition={condition} resourceOptions={resourceOptions} onChange={onChange} /></div></div>;
}

function ConditionValue({ condition, resourceOptions, onChange }: { condition: Policy["conditions"][number]; resourceOptions: ResourceOption[]; onChange: (value: Policy["conditions"][number]) => void }) {
  const options = conditionOptions(condition.attribute, resourceOptions);
  if (!options) return <Field label="Value"><input required value={String(condition.value ?? "")} placeholder="Enter a value" onChange={(event) => onChange({ ...condition, value: event.target.value })} /></Field>;
  return <Field label="Value"><select required value={String(condition.value ?? "")} onChange={(event) => onChange({ ...condition, value: options.numeric ? Number(event.target.value) : event.target.value })}><option value="" disabled>Choose a value</option>{options.items.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></Field>;
}

function conditionOptions(attribute: string, resourceOptions: ResourceOption[]) {
  if (attribute === "subject.role") return { numeric: false, items: [{ value: "member", label: "Member" }, { value: "admin", label: "Administrator" }, { value: "owner", label: "Workspace owner" }] };
  if (attribute === "target.resource") return { numeric: false, items: [{ value: "*", label: "All workspace areas" }, ...resourceOptions.filter((item) => item.key !== "*").map((item) => ({ value: item.key, label: item.name }))] };
  if (attribute === "target.action") return { numeric: false, items: [{ value: "*", label: "Any action" }, { value: "viewAny", label: "View lists" }, { value: "view", label: "View details" }, { value: "create", label: "Create" }, { value: "update", label: "Edit" }, { value: "delete", label: "Delete" }, { value: "assign", label: "Assign" }, { value: "export", label: "Export" }, { value: "restore", label: "Restore" }] };
  if (attribute === "env.weekday") return { numeric: true, items: [{ value: 0, label: "Sunday" }, { value: 1, label: "Monday" }, { value: 2, label: "Tuesday" }, { value: 3, label: "Wednesday" }, { value: 4, label: "Thursday" }, { value: 5, label: "Friday" }, { value: 6, label: "Saturday" }] };
  if (attribute === "env.hour") return { numeric: true, items: Array.from({ length: 24 }, (_, hour) => ({ value: hour, label: `${String(hour).padStart(2, "0")}:00` })) };
  return null;
}

function RemoveButton({ onClick }: { onClick: () => void }) {
  return <button type="button" onClick={onClick} className="shrink-0 rounded-lg border border-line px-2.5 py-2 text-xs font-semibold text-ink-soft hover:border-bad hover:text-bad">Remove</button>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="grid gap-1.5 text-sm font-semibold">{label}<span className="font-normal">{children}</span></label>;
}

function BackupCreator({ saving, onCreate, error }: { saving: boolean; onCreate: () => void; error: string }) {
  return <div className="max-w-xl rounded-2xl border border-line bg-card p-6"><h1 className="font-display text-2xl font-bold">Create backup</h1><p className="mt-2 text-ink-soft">Create an encrypted snapshot of the workspace tables.</p>{error && <p className="mt-4 text-sm text-bad">{error}</p>}<button type="button" onClick={onCreate} disabled={saving} className="mt-6 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-50">{saving ? "Creating…" : "Create backup"}</button></div>;
}

function toPolicy(initial?: Record<string, unknown>): Policy {
  return {
    id: String(initial?.id ?? ""), name: String(initial?.name ?? ""), description: initial?.description ? String(initial.description) : null,
    effect: initial?.effect === "deny" ? "deny" : "allow", enabled: initial?.enabled !== false,
    subjects: Array.isArray(initial?.subjects) ? initial.subjects as Policy["subjects"] : [{ kind: "role", value: "member" }],
    targets: Array.isArray(initial?.targets) ? initial.targets as Policy["targets"] : [{ resource: "*", action: "viewAny", resourceId: null }],
    conditions: Array.isArray(initial?.conditions) ? initial.conditions as Policy["conditions"] : [],
  };
}

function labelFor(resource: string) {
  return resource === "users" ? "person" : resource.slice(0, -1);
}

function parseSettingValue(value: string): string | number | boolean {
  if (value === "true") return true;
  if (value === "false") return false;
  if (value.trim() !== "" && Number.isFinite(Number(value))) return Number(value);
  return value;
}
