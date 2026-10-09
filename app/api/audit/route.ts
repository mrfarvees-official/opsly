import { listAudit } from "@/features/platform/application/audit";
import { respond } from "@/lib/http";

export async function GET(req: Request) {
  return respond(async () => {
    const q = new URL(req.url).searchParams;
    return listAudit({
      resource: q.get("resource") ?? undefined,
      action: q.get("action") ?? undefined,
      actor: q.get("actor") ?? undefined,
      outcome: q.get("outcome") ?? undefined,
      before: q.get("before") ?? undefined,
      limit: q.get("limit") ? Number(q.get("limit")) : undefined,
    });
  });
}
