import { describe, expect, it } from "vitest";

import { buildTenantDatabaseName } from "../domain/tenant-database-name";

describe("buildTenantDatabaseName", () => {
  it("creates an opsly-prefixed database", () => {
    expect(buildTenantDatabaseName("acme")).toBe("opsly_acme");
  });

  it("normalizes uppercase slugs", () => {
    expect(buildTenantDatabaseName("AcMe")).toBe("opsly_acme");
  });

  it("converts hyphens to underscores", () => {
    expect(buildTenantDatabaseName("my-company")).toBe("opsly_my_company");
  });

  it("rejects invalid slugs", () => {
    expect(() => buildTenantDatabaseName("acme company")).toThrow();
  });

  it("rejects SQL-like input", () => {
    expect(() =>
      buildTenantDatabaseName('acme"; DROP DATABASE opsly;'),
    ).toThrow();
  });
});
