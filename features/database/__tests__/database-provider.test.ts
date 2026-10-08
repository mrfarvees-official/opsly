import { describe, expect, it } from "vitest";

import type { DatabaseProvider } from "../application/database-provider";

describe("DatabaseProvider contract", () => {
  it("supports connect and disconnect", async () => {
    const database = {
      id: "database-1",
    };

    const provider: DatabaseProvider<typeof database> = {
      async connect() {
        return database;
      },

      async disconnect() {
        return undefined;
      },
    };

    const result = await provider.connect({
      id: "database-1",
      url: "postgresql://localhost/db",
    });

    expect(result).toBe(database);

    await expect(provider.disconnect(database)).resolves.toBeUndefined();
  });
});
