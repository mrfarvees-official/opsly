import { beforeEach, describe, expect, it, vi } from "vitest";

import type { TenantDatabaseResolver } from "../application/tenant-database-resolver";
import type { PostgresDatabase } from "../infrastructure/postgres/postgres-provider";
import type { DatabaseConnectionConfig } from "../domain/database-connection";
import type { TenantDatabase } from "../domain/tenant-database";

const providerMock = vi.hoisted(() => ({
  connect: vi.fn(),
  disconnect: vi.fn(),
}));

vi.mock("server-only", () => ({}));

// Avoid loading the real primary DB (requires env / network).
vi.mock("../server/tenant-database-resolver", () => ({
  PrimaryTenantDatabaseResolver: class {
    resolve = vi.fn();
  },
}));

// TenantDatabaseManager builds its own PostgresProvider, so replace it.
vi.mock("../infrastructure/postgres/postgres-provider", () => ({
  PostgresProvider: class {
    connect = providerMock.connect;
    disconnect = providerMock.disconnect;
  },
}));

import { TenantDatabaseManager } from "../server/tenant-database-manager";

function createTenantDatabase(id: string, tenantId: string): TenantDatabase {
  return {
    id,
    tenantId,
    role: "primary",
    status: "active",
    host: "localhost",
    port: 5432,
    database: `tenant_${tenantId}`,
    username: "tenant",
    password: "secret",
    ssl: false,
  };
}

function createResolver(
  resolve: TenantDatabaseResolver["resolve"],
): TenantDatabaseResolver & { resolve: ReturnType<typeof vi.fn> } {
  return { resolve: vi.fn(resolve) };
}

describe("TenantDatabaseManager", () => {
  beforeEach(() => {
    providerMock.connect.mockReset();
    providerMock.disconnect.mockReset();

    providerMock.connect.mockImplementation(
      async (config: DatabaseConnectionConfig) =>
        ({
          client: { end: vi.fn(async () => undefined) },
          db: { tenantDatabaseId: config.id },
        }) as unknown as PostgresDatabase,
    );
    providerMock.disconnect.mockResolvedValue(undefined);
  });

  it("creates a connection for a tenant", async () => {
    const resolver = createResolver(async () =>
      createTenantDatabase("db-1", "tenant-1"),
    );
    const manager = new TenantDatabaseManager(resolver);

    const result = await manager.get("tenant-1");

    expect(resolver.resolve).toHaveBeenCalledWith("tenant-1");
    expect(providerMock.connect).toHaveBeenCalledTimes(1);
    expect(providerMock.connect).toHaveBeenCalledWith({
      id: "db-1",
      url: "postgresql://tenant:secret@localhost:5432/tenant_tenant-1",
    });
    expect(result.db).toEqual({ tenantDatabaseId: "db-1" });
  });

  it("adds sslmode=require to the url when ssl is enabled", async () => {
    const resolver = createResolver(async () => ({
      ...createTenantDatabase("db-1", "tenant-1"),
      ssl: true,
    }));
    const manager = new TenantDatabaseManager(resolver);

    await manager.get("tenant-1");

    expect(providerMock.connect).toHaveBeenCalledWith({
      id: "db-1",
      url: "postgresql://tenant:secret@localhost:5432/tenant_tenant-1?sslmode=require",
    });
  });

  it("creates separate connections for different tenants", async () => {
    const resolver = createResolver(async (tenantId) =>
      createTenantDatabase(
        tenantId === "tenant-1" ? "db-1" : "db-2",
        tenantId,
      ),
    );
    const manager = new TenantDatabaseManager(resolver);

    const tenantA = await manager.get("tenant-1");
    const tenantB = await manager.get("tenant-2");

    expect(tenantA).not.toBe(tenantB);
    expect(providerMock.connect).toHaveBeenCalledTimes(2);
  });

  it("reuses a tenant database connection", async () => {
    const resolver = createResolver(async () =>
      createTenantDatabase("db-1", "tenant-1"),
    );
    const manager = new TenantDatabaseManager(resolver);

    const first = await manager.get("tenant-1");
    const second = await manager.get("tenant-1");

    expect(first).toBe(second);
    expect(providerMock.connect).toHaveBeenCalledTimes(1);
  });

  it("does not share tenant A connection with tenant B", async () => {
    const resolver = createResolver(async (tenantId) =>
      createTenantDatabase(`db-${tenantId}`, tenantId),
    );
    const manager = new TenantDatabaseManager(resolver);

    const databaseA = await manager.get("tenant-a");
    const databaseB = await manager.get("tenant-b");

    expect(databaseA).not.toBe(databaseB);
    expect(databaseA.db).toEqual({ tenantDatabaseId: "db-tenant-a" });
    expect(databaseB.db).toEqual({ tenantDatabaseId: "db-tenant-b" });
  });

  it("removes a tenant database connection", async () => {
    const resolver = createResolver(async () =>
      createTenantDatabase("db-1", "tenant-1"),
    );
    const manager = new TenantDatabaseManager(resolver);

    const database = await manager.get("tenant-1");
    await manager.remove("db-1");

    expect(providerMock.disconnect).toHaveBeenCalledTimes(1);
    expect(providerMock.disconnect).toHaveBeenCalledWith(database);
  });

  it("closes all tenant connections", async () => {
    const resolver = createResolver(async (tenantId) =>
      createTenantDatabase(`db-${tenantId}`, tenantId),
    );
    const manager = new TenantDatabaseManager(resolver);

    await manager.get("tenant-1");
    await manager.get("tenant-2");
    await manager.closeAll();

    expect(providerMock.disconnect).toHaveBeenCalledTimes(2);
  });

  it("propagates resolver errors", async () => {
    const resolver = createResolver(async () => {
      throw new Error("tenant database unavailable");
    });
    const manager = new TenantDatabaseManager(resolver);

    await expect(manager.get("tenant-1")).rejects.toThrow(
      "tenant database unavailable",
    );
    expect(providerMock.connect).not.toHaveBeenCalled();
  });
});
