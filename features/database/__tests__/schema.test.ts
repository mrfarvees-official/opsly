import { describe, expect, it } from "vitest";

import { tenant, tenantDatabase } from "../../tenant/infrastructure/schema";

describe("tenant database schema", () => {
  it("defines the tenant table", () => {
    expect(tenant).toBeDefined();

    expect(tenant.id).toBeDefined();

    expect(tenant.name).toBeDefined();

    expect(tenant.slug).toBeDefined();

    expect(tenant.status).toBeDefined();

    expect(tenant.createdAt).toBeDefined();

    expect(tenant.updatedAt).toBeDefined();
  });

  it("defines the tenant_database table", () => {
    expect(tenantDatabase).toBeDefined();

    expect(tenantDatabase.id).toBeDefined();

    expect(tenantDatabase.tenantId).toBeDefined();

    expect(tenantDatabase.role).toBeDefined();

    expect(tenantDatabase.status).toBeDefined();

    expect(tenantDatabase.host).toBeDefined();

    expect(tenantDatabase.port).toBeDefined();

    expect(tenantDatabase.database).toBeDefined();

    expect(tenantDatabase.username).toBeDefined();

    expect(tenantDatabase.password).toBeDefined();

    expect(tenantDatabase.ssl).toBeDefined();
  });
});
