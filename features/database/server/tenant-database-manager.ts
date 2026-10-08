import "server-only";
import { DatabaseManager } from "../application/database-manager";
import type { TenantDatabaseResolver } from "../application/tenant-database-resolver";
import {
  PostgresProvider,
  type PostgresDatabase,
} from "../infrastructure/postgres/postgres-provider";
import type { DatabaseConnectionConfig } from "../domain/database-connection";
import { PrimaryTenantDatabaseResolver } from "./tenant-database-resolver";
import { buildPostgresConnectionUrl } from "../infrastructure/postgres/postgres-connection-url";

export class TenantDatabaseManager {
  private readonly manager = new DatabaseManager<PostgresDatabase>(
    new PostgresProvider(),
  );

  constructor(private readonly resolver: TenantDatabaseResolver) {}

  async get(tenantId: string): Promise<PostgresDatabase> {
    const tenantDatabase = await this.resolver.resolve(tenantId);

    const connectionConfig: DatabaseConnectionConfig = {
      id: tenantDatabase.id,
      url: buildPostgresConnectionUrl(tenantDatabase),
    };

    return this.manager.register(connectionConfig);
  }

  async remove(tenantDatabaseId: string): Promise<void> {
    await this.manager.remove(tenantDatabaseId);
  }

  async closeAll(): Promise<void> {
    await this.manager.closeAll();
  }
}

const globalForTenantDatabase = globalThis as unknown as {
  tenantDatabaseManager: TenantDatabaseManager | undefined;
};

export const tenantDatabaseManager =
  globalForTenantDatabase.tenantDatabaseManager ??
  new TenantDatabaseManager(new PrimaryTenantDatabaseResolver());

if (process.env.NODE_ENV !== "production") {
  globalForTenantDatabase.tenantDatabaseManager = tenantDatabaseManager;
}
