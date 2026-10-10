import { createBusinessRule } from "@/features/platform/application/business-designer-service";
import { readJson, respond } from "@/lib/http";

export async function POST(request: Request) {
  return respond(() => createBusinessRule(readJson(request)), 201);
}
