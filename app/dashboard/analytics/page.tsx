import { AnalyticsDesigner } from "@/components/analytics-designer";
import { listAnalyticsDashboards } from "@/features/platform/application/analytics-service";
import { listResources } from "@/features/platform/application/resource-service";

export const instant = false;

export default async function AnalyticsPage() {
  const [dashboards, resources] = await Promise.all([listAnalyticsDashboards(), listResources()]);
  const sourceResources = resources.filter((resource) => !resource.system).map((resource) => ({ key: String(resource.key), name: String(resource.name) }));
  return <main className="p-6 sm:p-10"><header className="max-w-3xl"><p className="text-xs font-bold uppercase tracking-[0.18em] text-brand">Analytics</p><h1 className="mt-2 font-display text-4xl font-bold tracking-tight">See the business clearly.</h1><p className="mt-3 text-ink-soft">Create selective views from any business resource: metrics, charts, funnels, tables and more.</p></header><AnalyticsDesigner resources={sourceResources} /><section className="mt-8 rounded-2xl border border-line bg-card p-6"><div className="flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-brand">Saved views</p><h2 className="mt-1 font-display text-2xl font-bold">Analytics dashboards</h2></div><span className="text-sm text-ink-soft">{dashboards.length} total</span></div>{dashboards.length === 0 ? <p className="mt-5 text-sm text-ink-soft">Your published dashboards will appear here.</p> : <div className="mt-5 grid gap-3 md:grid-cols-2">{dashboards.map((dashboard) => <div key={dashboard.id} className="rounded-xl border border-line p-4"><div className="flex justify-between gap-3"><h3 className="font-semibold">{dashboard.name}</h3><span className="rounded-full bg-ok-tint px-2 py-1 text-xs font-bold text-ok">{dashboard.status}</span></div><p className="mt-1 text-sm text-ink-soft">{dashboard.widget_count} visualizations · /{dashboard.key}</p></div>)}</div>}</section></main>;
}
