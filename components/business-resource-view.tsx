"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Option = { id: string; label: string };
type Field = { key: string; label?: string; type?: string; description?: string; required?: boolean; calculation?: unknown; sensitive?: boolean; reference?: { allowMany?: boolean } };
type Props = { resource: string; initial: { name: string; rows: Record<string, unknown>[]; fields: Field[]; referenceOptions?: Record<string, Option[]>; page: number; pageSize: number; total: number } };

export function BusinessResourceView({ resource, initial }: Props) {
  const [data, setData] = useState(initial);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Record<string, unknown> | null>(null);
  const [modal, setModal] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const columns = data.fields.filter((field) => !field.sensitive).slice(0, 8);
  const totalPages = Math.max(1, Math.ceil(data.total / data.pageSize));

  async function load(page = 1, nextSearch = search) {
    setLoading(true);
    const response = await fetch(`/api/data/${encodeURIComponent(resource)}?page=${page}&search=${encodeURIComponent(nextSearch)}`);
    if (response.ok) setData(await response.json());
    setLoading(false);
  }

  useEffect(() => { const timer = setTimeout(() => void load(1, search), 250); return () => clearTimeout(timer); }, [search]);

  async function remove(id: string) {
    if (!window.confirm("Delete this record?")) return;
    const response = await fetch(`/api/data/${encodeURIComponent(resource)}/${encodeURIComponent(id)}`, { method: "DELETE" });
    const result = await response.json().catch(() => ({}));
    setMessage(response.ok ? "Record deleted." : result.error ?? "Could not delete record.");
    if (response.ok) void load(data.page);
  }

  return <div className="mt-8">
    <div className="flex flex-wrap items-center justify-between gap-4"><div><p className="text-sm text-ink-soft">{data.total} records</p><div className="mt-3 flex gap-2"><input className="business-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={`Search ${data.name.toLowerCase()}…`} /><button type="button" onClick={() => { setEditing(null); setModal(true); }} className="rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white">+ New {singular(data.name)}</button></div></div></div>
    {message && <p className="mt-4 rounded-xl bg-brand-tint px-4 py-3 text-sm font-semibold text-brand-dark">{message}</p>}
    {modal && <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4" role="dialog" aria-modal="true"><div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-line bg-card p-6 shadow-2xl"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-brand">{editing ? "Edit record" : "New record"}</p><h2 className="mt-1 font-display text-2xl font-bold">{editing ? "Update" : "Create"} {singular(data.name)}</h2></div><button type="button" onClick={() => setModal(false)} className="rounded-full border border-line px-3 py-1 text-xl text-ink-soft">×</button></div><BusinessRecordForm resource={resource} fields={data.fields} referenceOptions={data.referenceOptions ?? {}} initial={editing} onClose={() => setModal(false)} onSaved={() => { setModal(false); setMessage(editing ? "Record updated." : "Record created."); void load(data.page); }} /></div></div>}
    {loading ? <div className="mt-5 rounded-2xl border border-line bg-card p-10 text-center text-sm text-ink-soft">Loading…</div> : <div className="mt-5 overflow-x-auto rounded-2xl border border-line bg-card"><table className="w-full text-left text-sm"><thead className="border-b border-line bg-paper"><tr>{columns.map((field) => <th key={field.key} className="px-5 py-4 font-bold text-ink-soft">{field.label ?? field.key}</th>)}<th className="px-5 py-4 text-right font-bold text-ink-soft">Actions</th></tr></thead><tbody>{data.rows.map((row) => <tr key={String(row.id)} className="border-b border-line last:border-0">{columns.map((field) => <td key={field.key} className="px-5 py-4">{formatCell(row[field.key])}</td>)}<td className="px-5 py-4"><div className="flex justify-end gap-2"><Link href={`/dashboard/data/${encodeURIComponent(resource)}/${encodeURIComponent(String(row.id))}`} className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold">View</Link><button type="button" onClick={() => { setEditing(row); setModal(true); }} className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold">Edit</button><button type="button" onClick={() => remove(String(row.id))} className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-bad">Delete</button></div></td></tr>)}{data.rows.length === 0 && <tr><td colSpan={columns.length + 1} className="px-5 py-12 text-center text-ink-soft">No records found.</td></tr>}</tbody></table><div className="flex items-center justify-between border-t border-line px-5 py-4 text-sm"><span>Page {data.page} of {totalPages}</span><div className="flex gap-2"><button type="button" disabled={data.page <= 1} onClick={() => void load(data.page - 1)} className="rounded-lg border border-line px-3 py-1.5 disabled:opacity-40">Previous</button><button type="button" disabled={data.page >= totalPages} onClick={() => void load(data.page + 1)} className="rounded-lg border border-line px-3 py-1.5 disabled:opacity-40">Next</button></div></div></div>}
  </div>;
}

function BusinessRecordForm({ resource, fields, referenceOptions, initial, onClose, onSaved }: { resource: string; fields: Field[]; referenceOptions: Record<string, Option[]>; initial: Record<string, unknown> | null; onClose: () => void; onSaved: () => void }) {
  const editable = fields.filter((field) => !field.calculation && !field.sensitive);
  const [values, setValues] = useState<Record<string, unknown>>(() => Object.fromEntries(editable.map((field) => [field.key, initial?.[field.key] ?? (field.reference?.allowMany ? [] : "")] )));
  const [error, setError] = useState("");
  async function submit(event: React.FormEvent) { event.preventDefault(); setError(""); const response = await fetch(`/api/data/${encodeURIComponent(resource)}${initial?.id ? `/${encodeURIComponent(String(initial.id))}` : ""}`, { method: initial?.id ? "PATCH" : "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(values) }); const result = await response.json().catch(() => ({})); if (!response.ok) { setError(result.error ?? "Could not save record."); return; } onSaved(); }
  return <form onSubmit={submit} className="business-record-form mt-6"><div className="grid gap-4 sm:grid-cols-2">{editable.map((field) => <label key={field.key} className="text-sm font-semibold">{field.label ?? field.key}{field.description && <span className="mt-1 block text-xs font-normal text-ink-soft">{field.description}</span>}{field.reference ? <select required={field.required} multiple={Boolean(field.reference.allowMany)} value={field.reference.allowMany ? (Array.isArray(values[field.key]) ? values[field.key] as string[] : []) : String(values[field.key] ?? "")} onChange={(event) => setValues({ ...values, [field.key]: field.reference?.allowMany ? Array.from(event.target.selectedOptions).map((option) => option.value) : event.target.value })}><option value="">Choose {field.label ?? "a record"}</option>{(referenceOptions[field.key] ?? []).map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select> : <input required={field.required} type={field.type === "number" ? "number" : field.type === "date" ? "date" : field.type === "datetime" ? "datetime-local" : "text"} value={String(values[field.key] ?? "")} onChange={(event) => setValues({ ...values, [field.key]: field.type === "number" ? Number(event.target.value) : event.target.value })} />}</label>)}</div>{editable.length === 0 && <p className="rounded-xl bg-paper p-4 text-sm text-ink-soft">This resource has no manually entered fields.</p>}{error && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm font-semibold text-bad">{error}</p>}<div className="mt-6 flex gap-2"><button type="submit" className="rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white">{initial ? "Save changes" : "Create record"}</button><button type="button" onClick={onClose} className="rounded-xl border border-line px-4 py-2.5 text-sm font-semibold">Cancel</button></div></form>;
}

function singular(name: string) { return name.endsWith("s") ? name.slice(0, -1) : name; }
function formatCell(value: unknown) { return value === null || value === undefined || value === "" ? "—" : typeof value === "object" ? JSON.stringify(value) : String(value); }
