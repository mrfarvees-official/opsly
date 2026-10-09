import "server-only";

import type { Sql, TransactionSql } from "postgres";

import { HttpError, forbidden } from "../domain/errors";
import { isLogged, type ActionKey } from "../domain/permissions";
import { getTenantSql } from "../infrastructure/tenant-sql";

import { authorize } from "./authorize";
import { writeAudit } from "./audit";
import { getContext, type RequestContext } from "./context";

export interface RunSpec {
  resource: string;
  action: ActionKey;
  resourceId?: string;
  /** Extra facts about the target, usable in policy conditions as target.<name>. */
  attributes?: Record<string, unknown>;
}

export interface Note {
  resourceId?: string;
  details?: Record<string, unknown>;
}

export interface Scope {
  ctx: RequestContext;
  /** A transaction for logged actions, so the audit row commits with the change. */
  sql: Sql | TransactionSql;
  /** Add the id and details that go into the audit row. Never put secrets here. */
  note(n: Note): void;
}

export async function run<T>(
  spec: RunSpec,
  fn: (scope: Scope) => Promise<T>,
): Promise<T> {
  const base = await getContext();
  const sql = await getTenantSql(base.tenantId);

  const teams = await sql<{ team_id: string }[]>`
    select m.team_id from team_member m
    join team t on t.id = m.team_id
    where m.user_id = ${base.userId} and t.deleted_at is null`;
  const ctx: RequestContext = { ...base, teamIds: teams.map((t) => t.team_id) };

  const logged = isLogged(spec.action);
  const audit = {
    resource: spec.resource,
    action: spec.action,
    resourceId: spec.resourceId,
  };

  const decision = await authorize(sql, {
    ...ctx,
    teamIds: ctx.teamIds.join(","),
  }, {
    resource: spec.resource,
    action: spec.action,
    id: spec.resourceId,
    attributes: spec.attributes,
  });

  if (!decision.allowed) {
    await writeAudit(sql, ctx, {
      ...audit,
      outcome: "denied",
      details: { reason: decision.reason },
    });
    throw forbidden();
  }

  let noted: Note = {};
  const note = (n: Note) => {
    noted = { ...noted, ...n, details: { ...noted.details, ...n.details } };
  };

  try {
    if (!logged) return await fn({ ctx, sql, note });

    return (await sql.begin(async (tx) => {
      const result = await fn({ ctx, sql: tx, note });
      await writeAudit(tx as unknown as Sql, ctx, {
        ...audit,
        resourceId: noted.resourceId ?? spec.resourceId,
        outcome: "success",
        details: noted.details,
      });
      return result;
    })) as T;
  } catch (error) {
    if (logged) {
      await writeAudit(sql, ctx, {
        ...audit,
        outcome: "failure",
        details: {
          error: error instanceof Error ? error.message : "Unknown error",
        },
      }).catch((e) => console.error("Audit write failed:", e));
    }
    throw error instanceof HttpError ? error : error;
  }
}
