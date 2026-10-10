import { createAnalyticsDashboard, listAnalyticsDashboards } from "@/features/platform/application/analytics-service";
import { readJson, respond } from "@/lib/http";

export async function GET() { return respond(() => listAnalyticsDashboards()); }
export async function POST(req: Request) { return respond(async () => createAnalyticsDashboard(await readJson(req)), 201); }
