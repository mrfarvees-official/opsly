import "server-only";
import { primaryClient } from "../../server/primary-database";
import type { TanantDatabaseCreator } from "../../application/tenant-database-creator";

function quoteIdentifier(identifier: string): string {
  return `"${identifier.replaceAll('"', '""')}"`;
}

export class PostgresTenantDatabaseCreator implements TanantDatabaseCreator {
  async createDatabase(databaseName: string): Promise<void> {
    const quotedName = quoteIdentifier(databaseName);

    try {
      await primaryClient.unsafe(`CREATE DATABASE ${quotedName}`);
    } catch (error) {
      const postgresError = error as { code?: string };

      // PostgreSQL duplicate_database
      if (postgresError.code == "42P04") {
        return;
      }

      throw error;
    }
  }
}
