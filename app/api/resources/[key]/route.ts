import {
  deleteResource,
  updateResource,
} from "@/features/platform/application/resource-service";
import { readJson, respond } from "@/lib/http";

type Ctx = { params: Promise<{ key: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  return respond(async () =>
    updateResource((await params).key, await readJson(req)),
  );
}
export async function DELETE(_: Request, { params }: Ctx) {
  return respond(async () => deleteResource((await params).key));
}
