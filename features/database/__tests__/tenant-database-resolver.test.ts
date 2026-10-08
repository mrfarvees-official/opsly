import { beforeEach, describe, expect, it, vi } from "vitest";

const { limitMock, whereMock, fromMock, selectMock } = vi.hoisted(() => ({
  limitMock: vi.fn(),
  whereMock: vi.fn(),
  fromMock: vi.fn(),
  selectMock: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("../server/primary-database", () => ({
  primaryDb: { select: selectMock },
}));

import { TenantDatabaseNotFoundError } from "../domain/database-errors";

import { PrimaryTenantDatabaseResolver } from "../server/tenant-database-resolver";

describe("PrimaryTenantDatabaseResolver", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    selectMock.mockReturnValue({
      from: fromMock,
    });

    whereMock.mockReturnValue({ limit: limitMock });

    fromMock.mockReturnValue({
      where: whereMock,
    });
  });

  it("returns the active primary tenant database", async () => {
    const row = {
      id: "db-1",
      tenantId: "tenant-1",
      role: "primary",
      status: "active",
      host: "localhost",
      port: 5432,
      database: "tenant_1",
      username: "tenant",
      password: "secret",
      ssl: false,
    };

    limitMock.mockResolvedValue([row]);

    const resolver = new PrimaryTenantDatabaseResolver();

    const result = await resolver.resolve("tenant-1");

    expect(result).toEqual(row);

    expect(selectMock).toHaveBeenCalledTimes(1);

    expect(fromMock).toHaveBeenCalledTimes(1);

    expect(limitMock).toHaveBeenCalledTimes(1);
  });

  it("throws when no tenant database exists", async () => {
    limitMock.mockResolvedValue([]);

    const resolver = new PrimaryTenantDatabaseResolver();

    await expect(resolver.resolve("tenant-1")).rejects.toThrow(
      TenantDatabaseNotFoundError,
    );
  });

  it("propagates primary database errors", async () => {
    limitMock.mockRejectedValue(new Error("primary database unavailable"));

    const resolver = new PrimaryTenantDatabaseResolver();

    await expect(resolver.resolve("tenant-1")).rejects.toThrow(
      "primary database unavailable",
    );
  });

  it("returns the database credentials required for connection", async () => {
    const row = {
      id: "db-1",
      tenantId: "tenant-1",
      role: "primary",
      status: "active",
      host: "db.example.com",
      port: 5432,
      database: "tenant_1",
      username: "tenant_user",
      password: "secret",
      ssl: true,
    };

    limitMock.mockResolvedValue([row]);

    const resolver = new PrimaryTenantDatabaseResolver();

    const result = await resolver.resolve("tenant-1");

    expect(result.host).toBe("db.example.com");

    expect(result.port).toBe(5432);

    expect(result.database).toBe("tenant_1");

    expect(result.username).toBe("tenant_user");

    expect(result.password).toBe("secret");

    expect(result.ssl).toBe(true);
  });
});
