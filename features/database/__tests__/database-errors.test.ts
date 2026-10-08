import { describe, expect, it } from "vitest";

import {
  DatabaseNotFoundError,
  DatabaseAlreadyRegisteredError,
  TenantDatabaseNotFoundError,
} from "../domain/database-errors";

describe("database errors", () => {
  it("creates DatabaseNotFoundError", () => {
    const error = new DatabaseNotFoundError("database-1");

    expect(error).toBeInstanceOf(Error);

    expect(error.name).toBe("DatabaseNotFoundError");

    expect(error.message).toBe('Database "database-1" is not registered.');
  });

  it("creates DatabaseAlreadyRegisteredError", () => {
    const error = new DatabaseAlreadyRegisteredError("database-1");

    expect(error).toBeInstanceOf(Error);

    expect(error.name).toBe("DatabaseAlreadyRegisteredError");

    expect(error.message).toBe('Database "database-1" is already registered.');
  });

  it("creates TenantDatabaseNotFoundError", () => {
    const error = new TenantDatabaseNotFoundError("tenant-1");

    expect(error).toBeInstanceOf(Error);

    expect(error.name).toBe("TenantDatabaseNotFoundError");

    expect(error.message).toBe(
      'No active database found for tenant "tenant-1".',
    );
  });
});
