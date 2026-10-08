import { describe, expect, it } from "vitest";

import type { TenantDatabaseResolver } from "../application/tenant-database-resolver";

describe("TenantDatabaseResolver contract", () => {
  it("supports resolving a tenant database", async () => {
    const database = {
      id: "db-1",
      tenantId: "tenant-1",
      role: "primary" as const,
      status: "active" as const,
      host: "localhost",
      port: 5432,
      database: "tenant_1",
      username: "tenant",
      password: "secret",
      ssl: false,
    };

    const resolver: TenantDatabaseResolver = {
      async resolve() {
        return database;
      },
    };

    const result = await resolver.resolve("tenant-1");

    expect(result).toEqual(database);
  });
});
