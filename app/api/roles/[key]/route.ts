import { deleteRole, updateRole } from "@/features/platform/application/role-service";
import { readJson, respond } from "@/lib/http";

export async function PATCH(request: Request, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  return respond(async () => updateRole(key, await readJson(request)), 200);
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  return respond(() => deleteRole(key));
}
