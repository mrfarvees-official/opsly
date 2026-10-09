import {
  createUser,
  listUsers,
} from "@/features/platform/application/user-service";
import { readJson, respond } from "@/lib/http";

export async function GET() {
  return respond(() => listUsers());
}
export async function POST(req: Request) {
  return respond(async () => createUser(await readJson(req)), 201);
}
