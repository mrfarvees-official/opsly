/**
 * Append-only tenant migrations. IDs must stay strictly increasing. Never
 * edit or delete a shipped migration; the baseline DDL in tenant-sql.ts is
 * frozen and all later tenant schema changes belong here.
 */
export interface TenantMigration {
  id: number;
  name: string;
  sql: string;
}

export const MIGRATIONS: TenantMigration[] = [];
