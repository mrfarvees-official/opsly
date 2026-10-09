import {
  exportEntity,
  importEntity,
  readImportRows,
} from "@/features/platform/application/data-transfer-service";
import { respond } from "@/lib/http";

type Ctx = { params: Promise<{ entity: string }> };

export async function GET(req: Request, { params }: Ctx) {
  return respond(async () => {
    const { entity } = await params;
    const format = new URL(req.url).searchParams.get("format") ?? "json";
    const out = await exportEntity(entity, format);
    return new Response(out.body, {
      headers: {
        "Content-Type": out.contentType,
        "Content-Disposition": `attachment; filename="${out.fileName}"`,
        "Cache-Control": "no-store",
      },
    });
  });
}

export async function POST(req: Request, { params }: Ctx) {
  return respond(async () => {
    const { entity } = await params;
    return importEntity(entity, await readImportRows(req));
  });
}
