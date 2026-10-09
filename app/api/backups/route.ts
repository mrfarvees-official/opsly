import {
  createBackup,
  listBackups,
} from "@/features/platform/application/backup-service";
import { respond } from "@/lib/http";

export async function GET() {
  return respond(() => listBackups());
}
export async function POST() {
  return respond(() => createBackup(), 201);
}
