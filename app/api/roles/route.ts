import { createRole, listRoles } from "@/features/platform/application/role-service";
import { readJson, respond } from "@/lib/http";

export async function GET() {
  return respond(() => listRoles());
}

export async function POST(request: Request) {
  return respond(async () => createRole(await readJson(request)), 201);
}
