import { drizzle } from "drizzle-orm/postgres-js";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type postgres from "postgres";

export type DrizzleDatabase = PostgresJsDatabase<Record<string, never>>;

export function createDrizzleDatabase(
    client: ReturnType<typeof postgres>
): DrizzleDatabase {
    return drizzle(client);
}