import "server-only";

import { and, eq, isNull } from "drizzle-orm";

import { primaryDb } from "@/features/database/server/primary-database";
import { tenant } from "@/features/tenant/infrastructure/schema";

import { appUser } from "../infrastructure/schema";
import { verifyPassword } from "../infrastructure/password-verifier";

export interface LoginInput {
  tenantSlug: string;
  email: string;
  password: string;
}

export interface AuthenticatedUser {
  userId: string;
  tenantId: string;
}

// Verified when the account doesn't exist so response time doesn't reveal it.
const DUMMY_HASH = `scrypt$${"0".repeat(32)}$${"0".repeat(128)}`;

export class LoginService {
  /** Returns the user on success, or null for any invalid credential. */
  async authenticate(input: LoginInput): Promise<AuthenticatedUser | null> {
    const tenantSlug = input.tenantSlug.trim().toLowerCase();
    const email = input.email.trim().toLowerCase();

    const [row] = await primaryDb
      .select({
        userId: appUser.id,
        tenantId: appUser.tenantId,
        passwordHash: appUser.passwordHash,
        userStatus: appUser.status,
        tenantStatus: tenant.status,
      })
      .from(appUser)
      .innerJoin(tenant, eq(appUser.tenantId, tenant.id))
      .where(
        and(
          eq(tenant.slug, tenantSlug),
          eq(appUser.email, email),
          isNull(appUser.deletedAt),
        ),
      )
      .limit(1);

    const passwordOk = await verifyPassword(
      input.password,
      row?.passwordHash ?? DUMMY_HASH,
    );

    if (
      !row ||
      !passwordOk ||
      row.userStatus !== "active" ||
      row.tenantStatus !== "active"
    ) {
      return null;
    }

    return { userId: row.userId, tenantId: row.tenantId };
  }
}
