import { updateAnalyticsDashboard } from "@/features/platform/application/analytics-service";
import { readJson, respond } from "@/lib/http";

export async function PATCH(req: Request, ctx: RouteContext<"/api/analytics/[id]">) {
  const { id } = await ctx.params;
  return respond(() => updateAnalyticsDashboard(id, readJson(req)));
}
