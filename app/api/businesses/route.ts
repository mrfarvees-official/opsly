import { createBusinessDefinition, listBusinessDefinitions } from "@/features/platform/application/business-designer-service";
import { readJson, respond } from "@/lib/http";

export async function GET() {
  return respond(() => listBusinessDefinitions());
}

export async function POST(req: Request) {
  return respond(async () => createBusinessDefinition(await readJson(req)), 201);
}
