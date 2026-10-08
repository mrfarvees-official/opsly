import { describe, expect, it, vi } from "vitest";

import { DatabaseManager } from "../application/database-manager";

import { DatabaseNotFoundError } from "../domain/database-errors";

describe("DatabaseManager", () => {
  function createProvider() {
    return {
      connect: vi.fn(async (config) => ({
        id: config.id,
      })),

      disconnect: vi.fn(async () => undefined),
    };
  }

  it("registers a database", async () => {
    const provider = createProvider();

    const manager = new DatabaseManager(provider);

    const db = await manager.register({
      id: "tenant-a",
      url: "postgresql://a",
    });

    expect(db).toEqual({
      id: "tenant-a",
    });

    expect(provider.connect).toHaveBeenCalledTimes(1);
  });

  it("reuses an existing database", async () => {
    const provider = createProvider();

    const manager = new DatabaseManager(provider);

    const first = await manager.register({
      id: "tenant-a",
      url: "postgresql://a",
    });

    const second = await manager.register({
      id: "tenant-a",
      url: "postgresql://a",
    });

    expect(first).toBe(second);

    expect(provider.connect).toHaveBeenCalledTimes(1);
  });

  it("deduplicates concurrent registrations", async () => {
    let resolveConnection: ((value: object) => void) | undefined;

    const provider = {
      connect: vi.fn(
        () =>
          new Promise<object>((resolve) => {
            resolveConnection = resolve;
          }),
      ),

      disconnect: vi.fn(async () => undefined),
    };

    const manager = new DatabaseManager(provider);

    const firstPromise = manager.register({
      id: "tenant-a",
      url: "postgresql://a",
    });

    const secondPromise = manager.register({
      id: "tenant-a",
      url: "postgresql://a",
    });

    expect(provider.connect).toHaveBeenCalledTimes(1);

    const database = {
      id: "tenant-a",
    };

    resolveConnection?.(database);

    const [first, second] = await Promise.all([firstPromise, secondPromise]);

    expect(first).toBe(second);
  });

  it("reports has()", async () => {
    const provider = createProvider();

    const manager = new DatabaseManager(provider);

    expect(manager.has("tenant-a")).toBe(false);

    await manager.register({
      id: "tenant-a",
      url: "postgresql://a",
    });

    expect(manager.has("tenant-a")).toBe(true);
  });

  it("throws for unknown database", () => {
    const provider = createProvider();

    const manager = new DatabaseManager(provider);

    expect(() => manager.get("missing")).toThrow(DatabaseNotFoundError);
  });

  it("removes a database", async () => {
    const provider = createProvider();

    const manager = new DatabaseManager(provider);

    await manager.register({
      id: "tenant-a",
      url: "postgresql://a",
    });

    await manager.remove("tenant-a");

    expect(manager.has("tenant-a")).toBe(false);

    expect(provider.disconnect).toHaveBeenCalledTimes(1);
  });

  it("closes all databases", async () => {
    const provider = createProvider();

    const manager = new DatabaseManager(provider);

    await manager.register({
      id: "tenant-a",
      url: "postgresql://a",
    });

    await manager.register({
      id: "tenant-b",
      url: "postgresql://b",
    });

    await manager.closeAll();

    expect(provider.disconnect).toHaveBeenCalledTimes(2);

    expect(manager.has("tenant-a")).toBe(false);

    expect(manager.has("tenant-b")).toBe(false);
  });

  it("does not retain failed connections", async () => {
    const provider = {
      connect: vi.fn(async () => {
        throw new Error("connection failed");
      }),

      disconnect: vi.fn(async () => undefined),
    };

    const manager = new DatabaseManager(provider);

    await expect(
      manager.register({
        id: "tenant-a",
        url: "postgresql://a",
      }),
    ).rejects.toThrow("connection failed");

    expect(manager.has("tenant-a")).toBe(false);

    expect(provider.connect).toHaveBeenCalledTimes(1);
  });
});
