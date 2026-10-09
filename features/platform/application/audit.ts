import "server-only";

import type { Sql } from "postgres";

import { isLogged } from "../domain/permissions";

import { run } from "./run";

export interface AuditEntry {
  resource: string;
  action: string;
  resourceId?: string | null;
  outcome: "success" | "denied" | "failure";
  details?: Record<string, unknown>;
}

interface Actor {
  userId: string;
  email: string;
  ip: string | null;
  userAgent: string | null;
}

/** No-op for view and viewAny. Pass a transaction to commit atomically with the change. */
export async function writeAudit(sql: Sql, actor: Actor, e: AuditEntry) {
  if (!isLogged(e.action)) return;
  const details = e.details ? JSON.stringify(e.details) : null;
  await sql`
    insert into audit_log
      (actor_id, actor_email, resource, action, resource_id, outcome, details, ip, user_agent)
    values (
      ${actor.userId}, ${actor.email}, ${e.resource}, ${e.action},
      ${e.resourceId ?? null}, ${e.outcome},
      ${details}::jsonb,
      ${actor.ip}, ${actor.userAgent}
    )`;
}

export interface AuditQuery {
  resource?: string;
  action?: string;
  actor?: string;
  outcome?: string;
  before?: string;
  limit?: number;
}

export async function listAudit(q: AuditQuery) {
  return run({ resource: "audit", action: "viewAny" }, async ({ sql }) => {
    const limit = Math.min(Math.max(q.limit ?? 50, 1), 200);
    const before =
      q.before && !Number.isNaN(Date.parse(q.before)) ? q.before : null;

    const rows = await sql<{ id: string; created_at: Date }[]>`
      select id, actor_id, actor_email, resource, action, resource_id,
             outcome, details, ip, created_at
      from audit_log
      where true
        ${q.resource ? sql`and resource = ${q.resource}` : sql``}
        ${q.action ? sql`and action = ${q.action}` : sql``}
        ${q.actor ? sql`and actor_email = ${q.actor.toLowerCase()}` : sql``}
        ${q.outcome ? sql`and outcome = ${q.outcome}` : sql``}
        ${before ? sql`and created_at < ${before}` : sql``}
      order by created_at desc, id desc
      limit ${limit}`;

    return {
      items: rows,
      nextBefore:
        rows.length === limit ? rows[rows.length - 1].created_at : null,
    };
  });
}
