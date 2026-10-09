import { describe, expect, it } from "vitest";

import { MIGRATIONS } from "../infrastructure/tenant-migrations";

describe("tenant migrations", () => {
  it("has unique, strictly increasing ids and usable definitions", () => {
    const ids = MIGRATIONS.map((migration) => migration.id);

    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual([...ids].sort((a, b) => a - b));

    for (const migration of MIGRATIONS) {
      expect(Number.isInteger(migration.id)).toBe(true);
      expect(migration.name.trim()).not.toBe("");
      expect(migration.sql.trim()).not.toBe("");
    }
  });
});
