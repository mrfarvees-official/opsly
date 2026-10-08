import "server-only";

import { eq } from "drizzle-orm";

import { primaryDb } from "@/features/database/server/primary-database";

import { tenant, tenantDatabase } from "./schema";

import { appUser, role } from "@/features/auth/infrastructure/schema";

export interface CreateTenantOwnerRecordInput {
  tenantName: string;
  tenantSlug: string;
  ownerEmail: string;
  passwordHash: string;

  databaseName: string;

  host: string;
  port: number;
  username: string;
  password: string;
  ssl: boolean;
}

export class TenantOwnerProvisioningRepository {
  async createProvisioningRecords(input: CreateTenantOwnerRecordInput) {
    return primaryDb.transaction(async (tx) => {
      const [createdTenant] = await tx
        .insert(tenant)
        .values({
          name: input.tenantName,
          slug: input.tenantSlug,
        })
        .returning();

      if (!createdTenant) {
        throw new Error("Failed to create tenant.");
      }

      const ownerRoleResult = await tx
        .insert(role)
        .values({
          key: "owner",
          name: "Owner",
        })
        .onConflictDoNothing({
          target: role.key,
        })
        .returning();

      let ownerRole = ownerRoleResult[0];

      if (!ownerRole) {
        const existing = await tx
          .select()
          .from(role)
          .where(eq(role.key, "owner"))
          .limit(1);

        ownerRole = existing[0];
      }

      if (!ownerRole) {
        throw new Error("Owner role could not be resolved.");
      }

      const [owner] = await tx
        .insert(appUser)
        .values({
          tenantId: createdTenant.id,
          roleId: ownerRole.id,
          email: input.ownerEmail,
          passwordHash: input.passwordHash,
          status: "active",
        })
        .returning();

      if (!owner) {
        throw new Error("Failed to create owner account.");
      }

      const [database] = await tx
        .insert(tenantDatabase)
        .values({
          tenantId: createdTenant.id,

          role: "primary",

          status: "provisioning",

          host: input.host,

          port: input.port,

          database: input.databaseName,

          username: input.username,

          password: input.password,

          ssl: input.ssl,
        })
        .returning();

      if (!database) {
        throw new Error("Failed to create tenant database record.");
      }

      return {
        tenant: createdTenant,

        owner,

        database,
      };
    });
  }

  async markDatabaseActive(databaseId: string): Promise<void> {
    await primaryDb
      .update(tenantDatabase)
      .set({
        status: "active",
        updatedAt: new Date(),
      })
      .where(eq(tenantDatabase.id, databaseId));
  }

  async markDatabaseFailed(databaseId: string): Promise<void> {
    await primaryDb
      .update(tenantDatabase)
      .set({
        status: "failed",
        updatedAt: new Date(),
      })
      .where(eq(tenantDatabase.id, databaseId));
  }
}
