import { addMember } from "@/features/platform/application/team-service";
import { readJson, respond } from "@/lib/http";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return respond(
    async () => addMember((await params).id, await readJson(req)),
    201,
  );
}
