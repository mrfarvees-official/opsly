import { removeMember } from "@/features/platform/application/team-service";
import { respond } from "@/lib/http";

export async function DELETE(
  _: Request,
  { params }: { params: Promise<{ id: string; userId: string }> },
) {
  return respond(async () => {
    const { id, userId } = await params;
    return removeMember(id, userId);
  });
}
