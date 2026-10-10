"use client";

import { useState } from "react";

type Widget = { key: string; title: string; visualization: string; sourceResource: string };
type Resource = { key: string; name: string };

export function AnalyticsDesigner({ resources }: { resources: Resource[] }) {
  const [dashboard, setDashboard] = useState({ key: "", name: "" });
  const [widgets, setWidgets] = useState<Widget[]>([{ key: "overview", title: "Overview", visualization: "metric", sourceResource: resources[0]?.key ?? "" }]);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true); setMessage("");
    const response = await fetch("/api/analytics", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...dashboard, widgets }) });
    const result = await response.json().catch(() => ({}));
    setSaving(false);
    setMessage(response.ok ? "Analytics dashboard published." : result.error ?? "Could not publish dashboard.");
  }

  function update(index: number, patch: Partial<Widget>) { setWidgets((current) => current.map((widget, i) => i === index ? { ...widget, ...patch } : widget)); }

  return <section className="analytics-designer mt-8 rounded-2xl border border-line bg-card p-6"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-brand">Analytics builder</p><h2 className="mt-2 font-display text-2xl font-bold">Compose a decision view</h2><p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-soft">Pick a resource for each widget, choose how it should be visualized, and keep the dashboard editable as the business evolves.</p></div><span className="rounded-full bg-brand-tint px-3 py-1 text-xs font-bold text-brand-dark">PBAC protected</span></div>
    <div className="mt-6 grid gap-4 sm:grid-cols-2"><label>Dashboard key<input value={dashboard.key} onChange={(e) => setDashboard({ ...dashboard, key: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_") })} placeholder="sales_health" /></label><label>Dashboard name<input value={dashboard.name} onChange={(e) => setDashboard({ ...dashboard, name: e.target.value })} placeholder="Sales health" /></label></div>
    <div className="mt-6 space-y-3">{widgets.map((widget, index) => <div className="grid gap-3 rounded-2xl border border-line bg-paper p-4 sm:grid-cols-[1fr_1fr_150px_1fr_auto]" key={index}><label>Widget key<input value={widget.key} onChange={(e) => update(index, { key: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_") })} /></label><label>Title<input value={widget.title} onChange={(e) => update(index, { title: e.target.value })} /></label><label>View<select value={widget.visualization} onChange={(e) => update(index, { visualization: e.target.value })}><option value="metric">Metric</option><option value="bar">Bar chart</option><option value="line">Line chart</option><option value="area">Area chart</option><option value="pie">Pie chart</option><option value="funnel">Funnel</option><option value="table">Table</option></select></label><label>Source resource<select value={widget.sourceResource} onChange={(e) => update(index, { sourceResource: e.target.value })}>{resources.map((resource) => <option key={resource.key} value={resource.key}>{resource.name}</option>)}</select></label><button type="button" className="self-end rounded-xl border border-line px-3 py-2.5 text-sm text-ink-soft hover:border-bad hover:text-bad" onClick={() => setWidgets(widgets.filter((_, i) => i !== index))}>Remove</button></div>)}</div>
    <div className="mt-5 flex flex-wrap items-center justify-between gap-3"><button type="button" className="rounded-xl border border-line px-4 py-2.5 text-sm font-semibold hover:border-brand" onClick={() => setWidgets([...widgets, { key: `widget_${widgets.length + 1}`, title: "New widget", visualization: "bar", sourceResource: resources[0]?.key ?? "" }])}>+ Add visualization</button><button type="button" disabled={saving || !dashboard.key || !dashboard.name || widgets.length === 0} onClick={save} className="rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-50">{saving ? "Publishing…" : "Publish dashboard"}</button></div>{message && <p className="mt-4 rounded-xl bg-brand-tint px-4 py-3 text-sm font-semibold text-brand-dark">{message}</p>}</section>;
}
