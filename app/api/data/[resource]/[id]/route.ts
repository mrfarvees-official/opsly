import { deleteBusinessRecord, getBusinessRecord, updateBusinessRecord } from "@/features/platform/application/business-designer-service";
import { readJson, respond } from "@/lib/http";

export async function GET(_request: Request, ctx: RouteContext<"/api/data/[resource]/[id]">) {
  const { resource, id } = await ctx.params;
  return respond(() => getBusinessRecord(resource, id));
}

export async function PATCH(request: Request, ctx: RouteContext<"/api/data/[resource]/[id]">) {
  const { resource, id } = await ctx.params;
  return respond(async () => updateBusinessRecord(resource, id, await readJson(request)));
}

export async function DELETE(_request: Request, ctx: RouteContext<"/api/data/[resource]/[id]">) {
  const { resource, id } = await ctx.params;
  return respond(() => deleteBusinessRecord(resource, id));
}
