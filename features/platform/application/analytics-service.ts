import "server-only";

import { badRequest, notFound } from "../domain/errors";
import { asObject, optText, text } from "../domain/validate";
import { run } from "./run";

const KEY = /^[a-z][a-z0-9_]{1,39}$/;
const VISUALIZATIONS = ["metric", "table", "bar", "line", "pie", "funnel", "area"] as const;
type Visualization = (typeof VISUALIZATIONS)[number];

function keyOf(value: unknown, label: string) {
  const key = text(value, label, { max: 40 });
  if (!KEY.test(key)) throw badRequest(`${label} must use lowercase letters, numbers and underscores.`);
  return key;
}

function widgetOf(raw: unknown, index: number) {
  const widget = asObject(raw, `Widget ${index + 1}`);
  const visualization = text(widget.visualization ?? "metric", "Visualization", { max: 20 }) as Visualization;
  if (!(VISUALIZATIONS as readonly string[]).includes(visualization)) throw badRequest(`Unsupported visualization for widget ${index + 1}.`);
  const query = widget.query && typeof widget.query === "object" ? widget.query : {};
  return {
    key: keyOf(widget.key, `Widget ${index + 1} key`),
    title: text(widget.title, `Widget ${index + 1} title`, { max: 100 }),
    visualization,
    sourceResource: keyOf(widget.sourceResource, `Widget ${index + 1} source resource`),
    snapshotId: typeof widget.snapshotId === "string" ? widget.snapshotId : null,
    query,
    layout: widget.layout && typeof widget.layout === "object" ? widget.layout : {},
  };
}

async function ensureResource(sql: any, resourceKey: string) {
  const [resource] = await sql`select key from resource where key = ${resourceKey}`;
  if (!resource) throw badRequest(`Resource ${resourceKey} was not found.`);
}

export async function listAnalyticsDashboards() {
  return run({ resource: "analytics", action: "viewAny" }, ({ sql }) => sql`
    select d.id, d.key, d.name, d.description, d.status, d.updated_at,
      count(w.id)::int as widget_count
    from analytics_dashboard d left join analytics_widget w on w.dashboard_id = d.id
    group by d.id order by d.updated_at desc
  `);
}

export async function getAnalyticsDashboard(idOrKey: string) {
  return run({ resource: "analytics", action: "view", resourceId: idOrKey }, async ({ sql }) => {
    const [dashboard] = await sql`select id, key, name, description, status, layout, filters, created_at, updated_at from analytics_dashboard where id::text = ${idOrKey} or key = ${idOrKey}`;
    if (!dashboard) throw notFound("Analytics dashboard");
    const widgets = await sql`select id, key, title, visualization, source_resource, snapshot_id, query, layout, position from analytics_widget where dashboard_id = ${dashboard.id} order by position, title`;
    return { ...dashboard, widgets };
  });
}

export async function createAnalyticsDashboard(input: unknown) {
  const body = asObject(input);
  const key = keyOf(body.key, "Key");
  const name = text(body.name, "Name", { max: 100 });
  const description = optText(body.description, "Description");
  const widgets = Array.isArray(body.widgets) ? body.widgets.map(widgetOf) : [];

  return run({ resource: "analytics", action: "create", resourceId: key }, async ({ sql, ctx, note }) => {
    const [dashboard] = await sql`insert into analytics_dashboard (key, name, description, status, layout, filters, created_by) values (${key}, ${name}, ${description}, 'published', ${JSON.stringify(body.layout && typeof body.layout === "object" ? body.layout : {})}, ${JSON.stringify(Array.isArray(body.filters) ? body.filters : [])}, ${ctx.userId}) returning id, key`;
    for (const [position, widget] of widgets.entries()) {
      await ensureResource(sql, widget.sourceResource);
      await sql`insert into analytics_widget (dashboard_id, key, title, visualization, source_resource, snapshot_id, query, layout, position) values (${dashboard.id}, ${widget.key}, ${widget.title}, ${widget.visualization}, ${widget.sourceResource}, ${widget.snapshotId}, ${JSON.stringify(widget.query)}, ${JSON.stringify(widget.layout)}, ${position})`;
    }
    note({ resourceId: dashboard.id, details: { key, widgetCount: widgets.length, visualizations: widgets.map((widget) => widget.visualization) } });
    return { id: dashboard.id, key };
  });
}

export async function updateAnalyticsDashboard(id: string, input: unknown) {
  const body = asObject(input);
  const name = text(body.name, "Name", { max: 100 });
  const description = optText(body.description, "Description");
  const status = body.status === "draft" || body.status === "published" || body.status === "archived" ? body.status : "published";
  const widgets = Array.isArray(body.widgets) ? body.widgets.map(widgetOf) : [];
  return run({ resource: "analytics", action: "update", resourceId: id }, async ({ sql, note }) => {
    const [dashboard] = await sql`update analytics_dashboard set name = ${name}, description = ${description}, status = ${status}, updated_at = now() where id = ${id} returning id`;
    if (!dashboard) throw notFound("Analytics dashboard");
    await sql`delete from analytics_widget where dashboard_id = ${id}`;
    for (const [position, widget] of widgets.entries()) {
      await ensureResource(sql, widget.sourceResource);
      await sql`insert into analytics_widget (dashboard_id, key, title, visualization, source_resource, snapshot_id, query, layout, position) values (${id}, ${widget.key}, ${widget.title}, ${widget.visualization}, ${widget.sourceResource}, ${widget.snapshotId}, ${JSON.stringify(widget.query)}, ${JSON.stringify(widget.layout)}, ${position})`;
    }
    note({ details: { widgetCount: widgets.length } });
    return { id };
  });
}
