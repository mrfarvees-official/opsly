import "server-only";

import type { Sql, TransactionSql } from "postgres";

import { badRequest } from "../domain/errors";
import { asObject, int, text } from "../domain/validate";

import { run } from "./run";

const DEFINITIONS = {
  "workspace.timezone": {
    default: "UTC",
    parse: (v: unknown) => text(v, "Timezone", { max: 60 }),
  },
  "workspace.locale": {
    default: "en",
    parse: (v: unknown) => text(v, "Locale", { max: 20 }),
  },
  "security.minPasswordLength": {
    default: 8,
    parse: (v: unknown) => int(v, "Minimum password length", 8, 64),
  },
  "audit.retentionDays": {
    default: 365,
    parse: (v: unknown) => int(v, "Audit retention days", 30, 3650),
  },
  "backup.retentionCount": {
    default: 14,
    parse: (v: unknown) => int(v, "Backups to keep", 1, 100),
  },
} as const;

export type SettingKey = keyof typeof DEFINITIONS;

type QuerySql = Sql | TransactionSql;

async function readAll(sql: QuerySql): Promise<Record<string, unknown>> {
  const rows = await sql<
    { key: string; value: unknown }[]
  >`select key, value from setting`;
  const stored = new Map(rows.map((r) => [r.key, r.value]));
  return Object.fromEntries(
    Object.entries(DEFINITIONS).map(([key, def]) => [
      key,
      stored.get(key) ?? def.default,
    ]),
  );
}

/** Internal read, no auth. Used by other services after they've authorized. */
export async function readSetting(
  sql: QuerySql,
  key: SettingKey,
): Promise<unknown> {
  const [row] = await sql<
    { value: unknown }[]
  >`select value from setting where key = ${key}`;
  return row ? row.value : DEFINITIONS[key].default;
}

export async function getSettings() {
  return run({ resource: "setting", action: "viewAny" }, ({ sql }) =>
    readAll(sql),
  );
}

export async function updateSettings(input: unknown) {
  const body = asObject(input);
  const entries = Object.entries(body);
  if (entries.length === 0) throw badRequest("Nothing to update.");

  const parsed = entries.map(([key, value]) => {
    const def = DEFINITIONS[key as SettingKey];
    if (!def) throw badRequest(`Unknown setting: ${key}.`);
    return [key, def.parse(value)] as const;
  });

  return run(
    { resource: "setting", action: "update" },
    async ({ ctx, sql, note }) => {
      const before = await readAll(sql);
      for (const [key, value] of parsed) {
        await sql`
        insert into setting (key, value, updated_by)
        values (${key}, ${sql.json(value as never)}, ${ctx.userId})
        on conflict (key) do update
          set value = excluded.value, updated_by = excluded.updated_by, updated_at = now()`;
      }
      note({
        details: {
          changes: Object.fromEntries(
            parsed.map(([k, v]) => [k, { from: before[k], to: v }]),
          ),
        },
      });
      return readAll(sql);
    },
  );
}
