import "server-only";

import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";

const url = process.env.DATABASE_URL;

if (!url) {
  throw new Error("DATABASE_URL is not configured.");
}

const client = postgres(url, {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
});

export const primaryDb = drizzle(client);
