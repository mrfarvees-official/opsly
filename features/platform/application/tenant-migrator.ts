import "server-only";

import { and, eq, isNull } from "drizzle-orm";

import { primaryDb } from "@/features/database/server/primary-database";
import {
  tenant,
  tenantDatabase,
} from "@/features/tenant/infrastructure/schema";

import { getTenantSql } from "../infrastructure/tenant-sql";

/** Brings every active tenant database up to the current schema and seeds. */
export async function migrateAllTenants() {
  const rows = await primaryDb
    .select({ tenantId: tenantDatabase.tenantId, slug: tenant.slug })
    .from(tenantDatabase)
    .innerJoin(tenant, eq(tenant.id, tenantDatabase.tenantId))
    .where(
      and(
        eq(tenantDatabase.status, "active"),
        eq(tenantDatabase.role, "primary"),
        isNull(tenantDatabase.deletedAt),
        isNull(tenant.deletedAt),
      ),
    );

  let failed = 0;
  // One at a time: each tenant opens its own connection pool.
  for (const row of rows) {
    try {
      await getTenantSql(row.tenantId);
    } catch (error) {
      failed++;
      console.error(`Tenant schema migration failed for "${row.slug}":`, error);
    }
  }

  console.log(
    `Tenant schemas checked: ${rows.length - failed} up to date, ${failed} failed.`,
  );
}
