import "server-only";

import { and, eq, inArray, isNull } from "drizzle-orm";

import { appUser } from "@/features/auth/infrastructure/schema";
import { primaryDb } from "@/features/database/server/primary-database";

export async function findTenantUsers(tenantId: string, ids: string[]) {
  if (ids.length === 0)
    return new Map<string, { id: string; email: string; status: string }>();

  const rows = await primaryDb
    .select({ id: appUser.id, email: appUser.email, status: appUser.status })
    .from(appUser)
    .where(
      and(
        eq(appUser.tenantId, tenantId),
        isNull(appUser.deletedAt),
        inArray(appUser.id, ids),
      ),
    );

  return new Map(rows.map((r) => [r.id, r]));
}
