import "server-only";

import { and, eq } from "drizzle-orm";

import { primaryDb } from "@/features/database/server/primary-database";

import { appUser, role } from "./schema";

export interface CreateOwnerInput {
  tenantId: string;
  email: string;
  passwordHash: string;
}

export class AuthRepository {
  async ensureOwnerRole() {
    const inserted = await primaryDb
      .insert(role)
      .values({
        key: "owner",
        name: "Owner",
      })
      .onConflictDoNothing({
        target: role.key,
      })
      .returning();

    if (inserted[0]) {
      return inserted[0];
    }

    const existing = await primaryDb
      .select()
      .from(role)
      .where(eq(role.key, "owner"))
      .limit(1);

    if (!existing[0]) {
      throw new Error("Owner role could not be created.");
    }

    return existing[0];
  }

  async createOwner(input: CreateOwnerInput) {
    const ownerRole = await this.ensureOwnerRole();

    const [created] = await primaryDb
      .insert(appUser)
      .values({
        tenantId: input.tenantId,
        roleId: ownerRole.id,
        email: input.email,
        passwordHash: input.passwordHash,
        status: "active",
      })
      .returning();

    if (!created) {
      throw new Error("Failed to create owner account.");
    }

    return created;
  }

  async findOwner(tenantId: string, email: string) {
    const result = await primaryDb
      .select({
        user: appUser,
        role,
      })
      .from(appUser)
      .innerJoin(role, eq(appUser.roleId, role.id))
      .where(and(eq(appUser.tenantId, tenantId), eq(appUser.email, email)))
      .limit(1);

    return result[0] ?? null;
  }
}
