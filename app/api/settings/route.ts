import {
  getSettings,
  updateSettings,
} from "@/features/platform/application/setting-service";
import { readJson, respond } from "@/lib/http";

export async function GET() {
  return respond(() => getSettings());
}
export async function PATCH(req: Request) {
  return respond(async () => updateSettings(await readJson(req)));
}
