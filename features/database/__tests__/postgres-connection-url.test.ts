import { describe, expect, it } from "vitest";

import { buildPostgresConnectionUrl } from "../infrastructure/postgres/postgres-connection-url";

describe("buildPostgresConnectionUrl", () => {
  it("builds a PostgreSQL URL", () => {
    const url = buildPostgresConnectionUrl({
      host: "localhost",
      port: 5432,
      database: "tenant_1",
      username: "tenant",
      password: "secret",
      ssl: false,
    });

    expect(url).toBe("postgresql://tenant:secret@localhost:5432/tenant_1");
  });

  it("adds SSL mode when SSL is enabled", () => {
    const url = buildPostgresConnectionUrl({
      host: "db.example.com",
      port: 5432,
      database: "tenant",
      username: "user",
      password: "secret",
      ssl: true,
    });

    expect(url).toBe(
      "postgresql://user:secret@db.example.com:5432/tenant?sslmode=require",
    );
  });

  it("URL-encodes the username", () => {
    const url = buildPostgresConnectionUrl({
      host: "localhost",
      port: 5432,
      database: "tenant",
      username: "user@example.com",
      password: "secret",
      ssl: false,
    });

    expect(url).toContain("user%40example.com");
  });

  it("URL-encodes the password", () => {
    const url = buildPostgresConnectionUrl({
      host: "localhost",
      port: 5432,
      database: "tenant",
      username: "user",
      password: "p@ss:word/test",
      ssl: false,
    });

    expect(url).toContain("p%40ss%3Aword%2Ftest");
  });

  it("URL-encodes the database name", () => {
    const url = buildPostgresConnectionUrl({
      host: "localhost",
      port: 5432,
      database: "tenant database",
      username: "user",
      password: "secret",
      ssl: false,
    });

    expect(url).toContain("tenant%20database");
  });
});
