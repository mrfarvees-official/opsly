import { createBusinessRecord, listBusinessTableRows } from "@/features/platform/application/business-designer-service";
import { readJson, respond } from "@/lib/http";

export async function GET(_request: Request, ctx: RouteContext<"/api/data/[resource]">) {
  const { resource } = await ctx.params;
  const url = new URL(_request.url);
  return respond(() => listBusinessTableRows(resource, {
    page: Number(url.searchParams.get("page") ?? 1),
    pageSize: Number(url.searchParams.get("pageSize") ?? 25),
    search: url.searchParams.get("search") ?? "",
  }));
}

export async function POST(request: Request, ctx: RouteContext<"/api/data/[resource]">) {
  const { resource } = await ctx.params;
  return respond(async () => createBusinessRecord(resource, await readJson(request)), 201);
}
