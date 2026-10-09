import {
  deleteUser,
  getUser,
  updateUser,
} from "@/features/platform/application/user-service";
import { readJson, respond } from "@/lib/http";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_: Request, { params }: Ctx) {
  return respond(async () => getUser((await params).id));
}
export async function PATCH(req: Request, { params }: Ctx) {
  return respond(async () =>
    updateUser((await params).id, await readJson(req)),
  );
}
export async function DELETE(_: Request, { params }: Ctx) {
  return respond(async () => deleteUser((await params).id));
}
