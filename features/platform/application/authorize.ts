import "server-only";

import type { Sql, TransactionSql } from "postgres";

import {
  decide,
  type Decision,
  type Policy,
  type PolicyCondition,
  type PolicySubject,
  type PolicyTarget,
  type Subject,
  type Target,
} from "./pbac-engine";

interface PolicyRow {
  id: string;
  name: string;
  description: string | null;
  effect: "allow" | "deny";
  enabled: boolean;
  created_at: Date;
}

type QuerySql = Sql | TransactionSql;

function group<T extends { pbac_id: string }>(rows: T[]) {
  const map = new Map<string, T[]>();
  for (const r of rows) {
    const list = map.get(r.pbac_id) ?? [];
    list.push(r);
    map.set(r.pbac_id, list);
  }
  return map;
}

export async function loadPolicies(
  sql: QuerySql,
  enabledOnly = false,
): Promise<Policy[]> {
  const rows = await sql<PolicyRow[]>`
    select id, name, description, effect, enabled, created_at from pbac
    ${enabledOnly ? sql`where enabled` : sql``}
    order by created_at, id`;
  if (rows.length === 0) return [];

  const subjects = group(
    await sql<
      { pbac_id: string; kind: PolicySubject["kind"]; value: string | null }[]
    >`
      select pbac_id, kind, value from pbac_subject`,
  );
  const targets = group(
    await sql<
      {
        pbac_id: string;
        resource: string;
        action: string;
        resource_id: string | null;
      }[]
    >`
      select pbac_id, resource, action, resource_id from pbac_target`,
  );
  const conditions = group(
    await sql<
      {
        pbac_id: string;
        attribute: string;
        operator: PolicyCondition["operator"];
        value: unknown;
        value_is_attribute: boolean;
      }[]
    >`select pbac_id, attribute, operator, value, value_is_attribute from pbac_condition`,
  );

  return rows.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    effect: p.effect,
    enabled: p.enabled,
    subjects: (subjects.get(p.id) ?? []).map(
      (s): PolicySubject => ({
        kind: s.kind,
        value: s.value,
      }),
    ),
    targets: (targets.get(p.id) ?? []).map(
      (t): PolicyTarget => ({
        resource: t.resource,
        action: t.action,
        resourceId: t.resource_id,
      }),
    ),
    conditions: (conditions.get(p.id) ?? []).map(
      (c): PolicyCondition => ({
        attribute: c.attribute,
        operator: c.operator,
        value: c.value,
        valueIsAttribute: c.value_is_attribute,
      }),
    ),
  }));
}

export async function authorize(
  sql: QuerySql,
  subject: Subject,
  target: Target,
): Promise<Decision> {
  // Owners are never locked out by a bad policy.
  if (subject.role === "owner")
    return { allowed: true, reason: "Workspace owner." };
  return decide(await loadPolicies(sql, true), subject, target);
}
