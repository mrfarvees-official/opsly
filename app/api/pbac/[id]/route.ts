import {
  deletePolicy,
  getPolicy,
  updatePolicy,
} from "@/features/platform/application/pbac-service";
import { readJson, respond } from "@/lib/http";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_: Request, { params }: Ctx) {
  return respond(async () => getPolicy((await params).id));
}
export async function PUT(req: Request, { params }: Ctx) {
  return respond(async () =>
    updatePolicy((await params).id, await readJson(req)),
  );
}
export async function DELETE(_: Request, { params }: Ctx) {
  return respond(async () => deletePolicy((await params).id));
}
