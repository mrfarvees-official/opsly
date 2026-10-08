import type {
  TenantDatabase,
} from "../../database/domain/tenant-database";

import type {
  PostgresDatabase,
} from "../../database/infrastructure/postgres/postgres-provider";

export interface TenantDatabaseRegistrar {
  register(
    tenantDatabase: TenantDatabase,
  ): Promise<PostgresDatabase>;
}