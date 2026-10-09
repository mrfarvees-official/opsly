import { restoreBackup } from "@/features/platform/application/backup-service";
import { badRequest } from "@/features/platform/domain/errors";
import { asObject, uuid } from "@/features/platform/domain/validate";
import { readJson, respond } from "@/lib/http";

export async function POST(req: Request) {
  return respond(async () => {
    const type = req.headers.get("content-type") ?? "";

    if (type.includes("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("file");
      if (!(file instanceof File)) throw badRequest("Attach the backup file.");
      return restoreBackup({
        file: Buffer.from(await file.arrayBuffer()),
        confirm: form.get("confirm") === "true",
      });
    }

    const body = asObject(await readJson(req));
    return restoreBackup({
      backupId: uuid(body.backupId, "Backup id"),
      confirm: body.confirm === true,
    });
  });
}
