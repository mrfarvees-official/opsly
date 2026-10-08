import "server-only";
import { eq, and } from "drizzle-orm";
import { primaryDb } from "./primary-database";
import type { TenantDatabaseResolver } from "../application/tenant-database-resolver";
import { TenantDatabaseNotFoundError } from "../domain/database-errors";
import type { TenantDatabase } from "../domain/tenant-database";
import { tenantDatabase } from "@/features/tenant/infrastructure/schema";

export class PrimaryTenantDatabaseResolver implements TenantDatabaseResolver {
  async resolve(tenantId: string): Promise<TenantDatabase> {
    const result = await primaryDb
      .select()
      .from(tenantDatabase)
      .where(
        and(
          eq(tenantDatabase.tenantId, tenantId),
          eq(tenantDatabase.status, "active"),
          eq(tenantDatabase.role, "primary"),
        ),
      )
      .limit(1);

    const database = result[0];

    if (!database) {
      throw new TenantDatabaseNotFoundError(tenantId);
    }

    return {
      id: database.id,
      tenantId: database.tenantId,
      role: database.role,
      status: database.status,
      host: database.host,
      port: database.port,
      database: database.database,
      username: database.username,
      password: database.password,
      ssl: database.ssl,
    };
  }
}
