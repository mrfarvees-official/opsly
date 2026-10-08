import "server-only";

export {
  primaryDb,
} from "./server/primary-database";

export {
  tenantDatabaseManager,
} from "./server/tenant-database-manager";

export type {
  DatabaseId,
  DatabaseConnectionConfig,
} from "./domain/database-connection";

export type {
  TenantDatabase,
  TenantDatabaseRole,
  TenantDatabaseStatus,
} from "./domain/tenant-database";