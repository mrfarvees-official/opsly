import { describe, expect, it, vi } from "vitest";

import { DatabaseManager } from "../application/database-manager";

import type { DatabaseProvider } from "../application/database-provider";

import { DatabaseNotFoundError } from "../domain/database-errors";

import type { DatabaseConnectionConfig } from "../domain/database-connection";

interface TestDatabase {
  id: string;
}

function createProvider() {
  const databases = new Map<string, TestDatabase>();

  const provider: DatabaseProvider<TestDatabase> = {
    connect: vi.fn(async (config: DatabaseConnectionConfig) => {
      const database = {
        id: config.id,
      };

      databases.set(config.id, database);

      return database;
    }),

    disconnect: vi.fn(async (database: TestDatabase) => {
      databases.delete(database.id);
    }),
  };

  return {
    provider,
    databases,
  };
}

describe("DatabaseManager", () => {
  it("registers a new database", async () => {
    const { provider } = createProvider();

    const manager = new DatabaseManager(provider);

    const config = {
      id: "database-1",
      url: "postgresql://localhost/db1",
    };

    const database = await manager.register(config);

    expect(database).toEqual({
      id: "database-1",
    });

    expect(provider.connect).toHaveBeenCalledTimes(1);

    expect(provider.connect).toHaveBeenCalledWith(config);
  });

  it("returns the existing database when registering the same id", async () => {
    const { provider } = createProvider();

    const manager = new DatabaseManager(provider);

    const config = {
      id: "database-1",
      url: "postgresql://localhost/db1",
    };

    const first = await manager.register(config);

    const second = await manager.register(config);

    expect(first).toBe(second);

    expect(provider.connect).toHaveBeenCalledTimes(1);
  });

  it("gets a registered database", async () => {
    const { provider } = createProvider();

    const manager = new DatabaseManager(provider);

    const database = await manager.register({
      id: "database-1",
      url: "postgresql://localhost/db1",
    });

    expect(manager.get("database-1")).toBe(database);
  });

  it("throws when getting an unknown database", () => {
    const { provider } = createProvider();

    const manager = new DatabaseManager(provider);

    expect(() => manager.get("unknown")).toThrow(DatabaseNotFoundError);
  });

  it("reports whether a database exists", async () => {
    const { provider } = createProvider();

    const manager = new DatabaseManager(provider);

    expect(manager.has("database-1")).toBe(false);

    await manager.register({
      id: "database-1",
      url: "postgresql://localhost/db1",
    });

    expect(manager.has("database-1")).toBe(true);
  });

  it("removes a database", async () => {
    const { provider } = createProvider();

    const manager = new DatabaseManager(provider);

    const database = await manager.register({
      id: "database-1",
      url: "postgresql://localhost/db1",
    });

    await manager.remove("database-1");

    expect(provider.disconnect).toHaveBeenCalledTimes(1);

    expect(provider.disconnect).toHaveBeenCalledWith(database);

    expect(manager.has("database-1")).toBe(false);
  });

  it("throws when removing an unknown database", async () => {
    const { provider } = createProvider();

    const manager = new DatabaseManager(provider);

    await expect(manager.remove("unknown")).rejects.toThrow(
      DatabaseNotFoundError,
    );
  });

  it("closes all databases", async () => {
    const { provider } = createProvider();

    const manager = new DatabaseManager(provider);

    await manager.register({
      id: "database-1",
      url: "postgresql://localhost/db1",
    });

    await manager.register({
      id: "database-2",
      url: "postgresql://localhost/db2",
    });

    await manager.register({
      id: "database-3",
      url: "postgresql://localhost/db3",
    });

    await manager.closeAll();

    expect(provider.disconnect).toHaveBeenCalledTimes(3);

    expect(manager.has("database-1")).toBe(false);

    expect(manager.has("database-2")).toBe(false);

    expect(manager.has("database-3")).toBe(false);
  });

  it("does not register a database when connection fails", async () => {
    const provider: DatabaseProvider<TestDatabase> = {
      connect: vi.fn(async () => {
        throw new Error("connection failed");
      }),

      disconnect: vi.fn(),
    };

    const manager = new DatabaseManager(provider);

    await expect(
      manager.register({
        id: "database-1",
        url: "postgresql://localhost/db1",
      }),
    ).rejects.toThrow("connection failed");

    expect(manager.has("database-1")).toBe(false);
  });

  it("does not disconnect a database that was never registered", async () => {
    const { provider } = createProvider();

    const manager = new DatabaseManager(provider);

    await expect(manager.remove("missing")).rejects.toThrow(
      DatabaseNotFoundError,
    );

    expect(provider.disconnect).not.toHaveBeenCalled();
  });

  it("can close all databases when none are registered", async () => {
    const { provider } = createProvider();

    const manager = new DatabaseManager(provider);

    await manager.closeAll();

    expect(provider.disconnect).not.toHaveBeenCalled();
  });

  it("must not create duplicate connections during concurrent registration", async () => {
    let resolveConnection: ((database: TestDatabase) => void) | undefined;

    const provider: DatabaseProvider<TestDatabase> = {
      connect: vi.fn(
        () =>
          new Promise<TestDatabase>((resolve) => {
            resolveConnection = resolve;
          }),
      ),

      disconnect: vi.fn(async () => undefined),
    };

    const manager = new DatabaseManager(provider);

    const config = {
      id: "database-1",
      url: "postgresql://localhost/db1",
    };

    const first = manager.register(config);

    const second = manager.register(config);

    resolveConnection!({
      id: "database-1",
    });

    const [firstDatabase, secondDatabase] = await Promise.all([first, second]);

    expect(provider.connect).toHaveBeenCalledTimes(1);

    expect(firstDatabase).toBe(secondDatabase);
  });
});
