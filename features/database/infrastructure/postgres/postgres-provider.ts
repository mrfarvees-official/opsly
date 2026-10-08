import postgres, { type Sql } from "postgres";
import type { DatabaseProvider } from "../../application/database-provider";
import type { DatabaseConnectionConfig } from "../../domain/database-connection";
import {
  createDrizzleDatabase,
  type DrizzleDatabase,
} from "../drizzle/drizzle-database";

export interface PostgresDatabase {
  client: Sql;
  db: DrizzleDatabase;
}

export class PostgresProvider implements DatabaseProvider<PostgresDatabase> {
  async connect(config: DatabaseConnectionConfig): Promise<PostgresDatabase> {
    const client = postgres(config.url, {
      max: 10,
      idle_timeout: 20,
      connect_timeout: 10,
    });
    const db = createDrizzleDatabase(client);
    return { client, db };
  }

  async disconnect(database: PostgresDatabase): Promise<void> {
    await database.client.end();
  }
}
