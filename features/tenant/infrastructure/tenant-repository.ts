import "server-only";

import { eq } from "drizzle-orm";

import { primaryDb } from "@/features/database/server/primary-database";

import { tenant, tenantDatabase } from "./schema";

export interface CreateTenantInput {
  name: string;
  slug: string;
}

export interface CreateTenantDatabaseInput {
  tenantId: string;
  database: string;
  host: string;
  port: number;
  username: string;
  password: string;
  ssl: boolean;
}

export class TenantRepository {
  async create(input: CreateTenantInput) {
    const [created] = await primaryDb
      .insert(tenant)
      .values({
        name: input.name,
        slug: input.slug,
      })
      .returning();

    if (!created) {
      throw new Error("Failed to create tenant.");
    }

    return created;
  }

  async createDatabase(input: CreateTenantDatabaseInput) {
    const [created] = await primaryDb
      .insert(tenantDatabase)
      .values({
        tenantId: input.tenantId,
        database: input.database,
        host: input.host,
        port: input.port,
        username: input.username,
        password: input.password,
        ssl: input.ssl,
        status: "provisioning",
        role: "primary",
      })
      .returning();

    if (!created) {
      throw new Error("Failed to create tenant database record.");
    }

    return created;
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
