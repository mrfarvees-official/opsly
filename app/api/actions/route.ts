import { listActions } from "@/features/platform/application/resource-service";
import { respond } from "@/lib/http";

export async function GET() {
  return respond(() => listActions());
}
