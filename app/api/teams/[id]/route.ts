import {
  deleteTeam,
  getTeam,
  updateTeam,
} from "@/features/platform/application/team-service";
import { readJson, respond } from "@/lib/http";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_: Request, { params }: Ctx) {
  return respond(async () => getTeam((await params).id));
}
export async function PATCH(req: Request, { params }: Ctx) {
  return respond(async () =>
    updateTeam((await params).id, await readJson(req)),
  );
}
export async function DELETE(_: Request, { params }: Ctx) {
  return respond(async () => deleteTeam((await params).id));
}
