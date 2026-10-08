import { beforeEach, describe, expect, it, vi } from "vitest";

const { postgresMock, drizzleMock } = vi.hoisted(() => ({
  postgresMock: vi.fn(),
  drizzleMock: vi.fn(),
}));

vi.mock("postgres", () => ({
  default: postgresMock,
}));

vi.mock("drizzle-orm/postgres-js", () => ({
  drizzle: drizzleMock,
}));

import { PostgresProvider } from "../infrastructure/postgres/postgres-provider";

describe("PostgresProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a PostgreSQL client", async () => {
    const client = {
      end: vi.fn(),
    };

    const db = {
      query: vi.fn(),
    };

    postgresMock.mockReturnValue(client);

    drizzleMock.mockReturnValue(db);

    const provider = new PostgresProvider();

    const result = await provider.connect({
      id: "database-1",
      url: "postgresql://user:pass@localhost/db",
    });

    expect(postgresMock).toHaveBeenCalledTimes(1);

    expect(postgresMock).toHaveBeenCalledWith(
      "postgresql://user:pass@localhost/db",
      {
        max: 10,
        idle_timeout: 20,
        connect_timeout: 10,
      },
    );

    expect(drizzleMock).toHaveBeenCalledWith(client);

    expect(result.client).toBe(client);

    expect(result.db).toBe(db);
  });

  it("disconnects the PostgreSQL client", async () => {
    const client = {
      end: vi.fn(async () => undefined),
    };

    const provider = new PostgresProvider();

    await provider.disconnect({
      client: client as never,
      db: {} as never,
    });

    expect(client.end).toHaveBeenCalledTimes(1);
  });

  it("propagates PostgreSQL connection errors", async () => {
    postgresMock.mockImplementation(() => {
      throw new Error("PostgreSQL unavailable");
    });

    const provider = new PostgresProvider();

    await expect(
      provider.connect({
        id: "database-1",
        url: "postgresql://localhost/db",
      }),
    ).rejects.toThrow("PostgreSQL unavailable");
  });
});
