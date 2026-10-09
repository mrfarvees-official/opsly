import {
  createPolicy,
  listPolicies,
} from "@/features/platform/application/pbac-service";
import { readJson, respond } from "@/lib/http";

export async function GET() {
  return respond(() => listPolicies());
}
export async function POST(req: Request) {
  return respond(async () => createPolicy(await readJson(req)), 201);
}
