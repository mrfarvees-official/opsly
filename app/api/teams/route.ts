import {
  createTeam,
  listTeams,
} from "@/features/platform/application/team-service";
import { readJson, respond } from "@/lib/http";

export async function GET() {
  return respond(() => listTeams());
}
export async function POST(req: Request) {
  return respond(async () => createTeam(await readJson(req)), 201);
}
