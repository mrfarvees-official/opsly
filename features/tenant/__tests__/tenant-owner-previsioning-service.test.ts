import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("@/features/auth/infrastructure/password-hasher", () => ({
  hashPassword: vi.fn(async () => "hashed-password"),
}));

vi.mock(
  "@/features/database/infrastructure/postgres/primary-connection-details",
  () => ({
    getPrimaryConnectionDetails: vi.fn(() => ({
      host: "localhost",
      port: 5432,
      database: "primary",
      username: "tenant",
      password: "secret",
      ssl: false,
    })),
  }),
);

vi.mock("@/features/database/server/tenant-database-manager", () => ({
  tenantDatabaseManager: {
    register: vi.fn(async () => ({ client: {} })),
  },
}));

vi.mock("@/features/platform/infrastructure/tenant-sql", () => ({
  initializeTenantSchema: vi.fn(async () => undefined),
}));

// Default repository/creator are replaced by injected fakes; stub the modules
// so their real dependencies (DB clients) are not loaded.
vi.mock("../infrastructure/tenant-owner-provisioning-repository", () => ({
  TenantOwnerProvisioningRepository: class {},
}));

vi.mock(
  "@/features/database/infrastructure/postgres/postgres-database-creator",
  () => ({ PostgresTenantDatabaseCreator: class {} }),
);

import { TenantOwnerProvisioningService } from "../application/tenant-owner-provisioning-service";

describe("TenantOwnerProvisioningService", () => {
  it("creates a tenant owner and provisions its database", async () => {
    const repository = {
      createProvisioningRecords: vi.fn(async () => ({
        tenant: {
          id: "tenant-1",
        },

        owner: {
          id: "owner-1",
        },

        database: {
          id: "database-1",
        },
      })),

      markDatabaseActive: vi.fn(async () => undefined),

      markDatabaseFailed: vi.fn(async () => undefined),
    };

    const databaseCreator = {
      createDatabase: vi.fn(async () => undefined),
    };

    const service = new TenantOwnerProvisioningService(
      repository as never,
      databaseCreator,
    );

    /*
     * DatabaseManager is a server singleton in
     * the real application. For this unit test,
     * the important assertions are the repository
     * and creator calls.
     */
    const result = await service.createTenantOwner({
      tenantName: "Acme Corporation",

      tenantSlug: "acme",

      ownerEmail: "owner@acme.test",

      ownerPassword: "very-secure-password",
    });

    expect(result.tenantId).toBe("tenant-1");

    expect(result.ownerId).toBe("owner-1");

    expect(result.databaseName).toBe("opsly_acme");

    expect(databaseCreator.createDatabase).toHaveBeenCalledWith("opsly_acme");

    expect(repository.markDatabaseActive).toHaveBeenCalledWith("database-1");

    expect(repository.markDatabaseFailed).not.toHaveBeenCalled();
  });

  it("marks the database failed when provisioning fails", async () => {
    const repository = {
      createProvisioningRecords: vi.fn(async () => ({
        tenant: {
          id: "tenant-1",
        },

        owner: {
          id: "owner-1",
        },

        database: {
          id: "database-1",
        },
      })),

      markDatabaseActive: vi.fn(async () => undefined),

      markDatabaseFailed: vi.fn(async () => undefined),
    };

    const databaseCreator = {
      createDatabase: vi.fn(async () => {
        throw new Error("CREATE DATABASE failed");
      }),
    };

    const service = new TenantOwnerProvisioningService(
      repository as never,
      databaseCreator,
    );

    await expect(
      service.createTenantOwner({
        tenantName: "Acme",

        tenantSlug: "acme",

        ownerEmail: "owner@acme.test",

        ownerPassword: "very-secure-password",
      }),
    ).rejects.toThrow("CREATE DATABASE failed");

    expect(repository.markDatabaseFailed).toHaveBeenCalledWith("database-1");
  });

  it("marks the database failed when schema initialization fails", async () => {
    const repository = {
      createProvisioningRecords: vi.fn(async () => ({
        tenant: { id: "tenant-1" },
        owner: { id: "owner-1" },
        database: { id: "database-1" },
      })),
      markDatabaseActive: vi.fn(async () => undefined),
      markDatabaseFailed: vi.fn(async () => undefined),
    };

    const service = new TenantOwnerProvisioningService(
      repository as never,
      { createDatabase: vi.fn(async () => undefined) },
      vi.fn(async () => {
        throw new Error("schema failed");
      }),
    );

    await expect(
      service.createTenantOwner({
        tenantName: "Acme",
        tenantSlug: "acme",
        ownerEmail: "owner@acme.test",
        ownerPassword: "very-secure-password",
      }),
    ).rejects.toThrow("schema failed");

    expect(repository.markDatabaseActive).not.toHaveBeenCalled();
    expect(repository.markDatabaseFailed).toHaveBeenCalledWith("database-1");
  });
});
