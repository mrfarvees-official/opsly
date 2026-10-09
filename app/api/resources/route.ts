import {
  createResource,
  listResources,
} from "@/features/platform/application/resource-service";
import { readJson, respond } from "@/lib/http";

export async function GET() {
  return respond(() => listResources());
}
export async function POST(req: Request) {
  return respond(async () => createResource(await readJson(req)), 201);
}
