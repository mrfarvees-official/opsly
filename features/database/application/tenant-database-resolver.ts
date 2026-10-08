import type { TenantDatabase } from "../domain/tenant-database";

export interface TenantDatabaseResolver {
  resolve(tenantId: string): Promise<TenantDatabase>;
}
