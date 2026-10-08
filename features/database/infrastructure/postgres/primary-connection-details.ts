import "server-only";
import type { PostgresConnectionDetails } from "./postgres-connection-url";

export function getPrimaryConnectionDetails(): PostgresConnectionDetails {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not configured.");
  }

  const url = new URL(databaseUrl);

  const sslMode = url.searchParams.get("sslmode");

  return {
    host: url.hostname,

    port: Number(url.port || 5432),

    database: decodeURIComponent(url.pathname.replace(/^\//, "")),

    username: decodeURIComponent(url.username),

    password: decodeURIComponent(url.password),

    ssl:
      sslMode === "require" ||
      sslMode === "verify-ca" ||
      sslMode === "verify-full",
  };
}
