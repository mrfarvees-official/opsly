import "server-only";

import { and, eq, isNull } from "drizzle-orm";
import { cookies, headers } from "next/headers";

import { appUser, role } from "@/features/auth/infrastructure/schema";
import {
  SESSION_COOKIE_NAME,
  verifySessionToken,
} from "@/features/auth/infrastructure/session";
import { primaryDb } from "@/features/database/server/primary-database";
import { tenant } from "@/features/tenant/infrastructure/schema";

import { unauthorized } from "../domain/errors";

export interface RequestContext {
  userId: string;
  tenantId: string;
  email: string;
  role: string;
  teamIds: string[];
  ip: string | null;
  userAgent: string | null;
}

/** Re-checks the user and tenant on every request, so disabling takes effect immediately. */
export async function getContext(): Promise<Omit<RequestContext, "teamIds">> {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  const session = token ? verifySessionToken(token) : null;
  if (!session) throw unauthorized();

  const [row] = await primaryDb
    .select({
      userId: appUser.id,
      tenantId: appUser.tenantId,
      email: appUser.email,
      role: role.key,
      userStatus: appUser.status,
      tenantStatus: tenant.status,
    })
    .from(appUser)
    .innerJoin(role, eq(appUser.roleId, role.id))
    .innerJoin(tenant, eq(appUser.tenantId, tenant.id))
    .where(
      and(
        eq(appUser.id, session.userId),
        eq(appUser.tenantId, session.tenantId),
        isNull(appUser.deletedAt),
      ),
    )
    .limit(1);

  if (!row || row.userStatus !== "active" || row.tenantStatus !== "active") {
    throw unauthorized();
  }

  const h = await headers();
  return {
    userId: row.userId,
    tenantId: row.tenantId,
    email: row.email,
    role: row.role,
    ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip"),
    userAgent: h.get("user-agent")?.slice(0, 300) ?? null,
  };
}
