import {
  deleteBackup,
  downloadBackup,
} from "@/features/platform/application/backup-service";
import { respond } from "@/lib/http";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_: Request, { params }: Ctx) {
  return respond(async () => {
    const { fileName, data } = await downloadBackup((await params).id);
    return new Response(new Uint8Array(data), {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "no-store",
      },
    });
  });
}
export async function DELETE(_: Request, { params }: Ctx) {
  return respond(async () => deleteBackup((await params).id));
}
