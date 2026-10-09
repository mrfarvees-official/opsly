import "server-only";

import type { Sql, TransactionSql } from "postgres";

import { badRequest, notFound } from "../domain/errors";
import { asObject, list, oneOf, optText, text, uuid } from "../domain/validate";

import { loadPolicies } from "./authorize";
import type {
  Operator,
  PolicyCondition,
  PolicySubject,
  PolicyTarget,
} from "./pbac-engine";
import { run } from "./run";

const SUBJECT_KINDS = ["user", "role", "team", "everyone"] as const;
const OPERATORS: readonly Operator[] = [
  "eq",
  "neq",
  "in",
  "notIn",
  "contains",
  "gt",
  "gte",
  "lt",
  "lte",
];
const ATTRIBUTE = /^(subject|target|env)\.[A-Za-z][A-Za-z0-9_]{0,40}$/;
const ROLE_KEY = /^[a-z][a-z0-9_-]{1,40}$/;

type QuerySql = Sql | TransactionSql;

interface ParsedPolicy {
  name: string;
  description: string | null;
  effect: "allow" | "deny";
  enabled: boolean;
  subjects: PolicySubject[];
  targets: PolicyTarget[];
  conditions: PolicyCondition[];
}

async function parsePolicy(
  sql: QuerySql,
  input: unknown,
): Promise<ParsedPolicy> {
  const body = asObject(input);
  const resources = new Set(
    (await sql<{ key: string }[]>`select key from resource`).map((r) => r.key),
  );
  const actions = new Set(
    (await sql<{ key: string }[]>`select key from action`).map((a) => a.key),
  );

  const subjects = list(body.subjects, "Subjects").map((raw): PolicySubject => {
    const s = asObject(raw, "Subject");
    const kind = oneOf(s.kind, "Subject kind", SUBJECT_KINDS);
    if (kind === "everyone") return { kind, value: null };
    if (kind === "role") {
      const v = text(s.value, "Role", { max: 40 });
      if (!ROLE_KEY.test(v)) throw badRequest("Role is invalid.");
      return { kind, value: v };
    }
    return {
      kind,
      value: uuid(s.value, kind === "user" ? "User id" : "Team id"),
    };
  });

  const targets = list(body.targets, "Targets").map((raw): PolicyTarget => {
    const t = asObject(raw, "Target");
    const resource = text(t.resource ?? "*", "Target resource", { max: 40 });
    const action = text(t.action ?? "*", "Target action", { max: 40 });
    if (resource !== "*" && !resources.has(resource))
      throw badRequest(`Unknown resource: ${resource}.`);
    if (action !== "*" && !actions.has(action))
      throw badRequest(`Unknown action: ${action}.`);
    return {
      resource,
      action,
      resourceId: optText(t.resourceId, "Resource id", 100),
    };
  });

  const conditions = list(body.conditions, "Conditions", 20).map(
    (raw): PolicyCondition => {
      const c = asObject(raw, "Condition");
      const attribute = text(c.attribute, "Condition attribute", { max: 60 });
      if (!ATTRIBUTE.test(attribute)) {
        throw badRequest(
          "Condition attribute must look like subject.userId, target.teamId or env.hour.",
        );
      }
      const valueIsAttribute = c.valueIsAttribute === true;
      if (c.value === undefined)
        throw badRequest("Condition value is required.");
      if (
        valueIsAttribute &&
        (typeof c.value !== "string" || !ATTRIBUTE.test(c.value))
      ) {
        throw badRequest(
          "Condition value must be an attribute path when valueIsAttribute is true.",
        );
      }
      return {
        attribute,
        operator: oneOf(c.operator, "Condition operator", OPERATORS),
        value: c.value,
        valueIsAttribute,
      };
    },
  );

  if (subjects.length === 0) throw badRequest("Add at least one subject.");
  if (targets.length === 0) throw badRequest("Add at least one target.");

  return {
    name: text(body.name, "Policy name", { max: 120 }),
    description: optText(body.description, "Description"),
    effect: oneOf(body.effect, "Effect", ["allow", "deny"] as const),
    enabled: body.enabled === undefined ? true : body.enabled === true,
    subjects,
    targets,
    conditions,
  };
}

async function writeChildren(sql: QuerySql, id: string, p: ParsedPolicy) {
  for (const s of p.subjects) {
    await sql`insert into pbac_subject (pbac_id, kind, value) values (${id}, ${s.kind}, ${s.value})`;
  }
  for (const t of p.targets) {
    await sql`insert into pbac_target (pbac_id, resource, action, resource_id)
              values (${id}, ${t.resource}, ${t.action}, ${t.resourceId})`;
  }
  for (const c of p.conditions) {
    await sql`insert into pbac_condition (pbac_id, attribute, operator, value, value_is_attribute)
              values (${id}, ${c.attribute}, ${c.operator}, ${sql.json(c.value as never)}, ${c.valueIsAttribute})`;
  }
}

export async function listPolicies() {
  return run({ resource: "pbac", action: "viewAny" }, ({ sql }) =>
    loadPolicies(sql),
  );
}

export async function getPolicy(id: string) {
  uuid(id, "Policy id");
  return run(
    { resource: "pbac", action: "view", resourceId: id },
    async ({ sql }) => {
      const policy = (await loadPolicies(sql)).find((p) => p.id === id);
      if (!policy) throw notFound("Policy");
      return policy;
    },
  );
}

export async function createPolicy(input: unknown) {
  return run(
    { resource: "pbac", action: "create" },
    async ({ ctx, sql, note }) => {
      const p = await parsePolicy(sql, input);
      const [row] = await sql<{ id: string }[]>`
      insert into pbac (name, description, effect, enabled, created_by)
      values (${p.name}, ${p.description}, ${p.effect}, ${p.enabled}, ${ctx.userId})
      returning id`;
      await writeChildren(sql, row.id, p);
      note({
        resourceId: row.id,
        details: { name: p.name, effect: p.effect, policy: p as never },
      });
      return { id: row.id };
    },
  );
}

/** Full replace: send the whole policy. */
export async function updatePolicy(id: string, input: unknown) {
  uuid(id, "Policy id");
  return run(
    { resource: "pbac", action: "update", resourceId: id },
    async ({ sql, note }) => {
      const p = await parsePolicy(sql, input);
      const rows = await sql`
      update pbac set name = ${p.name}, description = ${p.description},
        effect = ${p.effect}, enabled = ${p.enabled}, updated_at = now()
      where id = ${id} returning id`;
      if (rows.length === 0) throw notFound("Policy");

      await sql`delete from pbac_subject where pbac_id = ${id}`;
      await sql`delete from pbac_target where pbac_id = ${id}`;
      await sql`delete from pbac_condition where pbac_id = ${id}`;
      await writeChildren(sql, id, p);

      note({
        details: {
          name: p.name,
          effect: p.effect,
          enabled: p.enabled,
          policy: p as never,
        },
      });
      return { id };
    },
  );
}

export async function deletePolicy(id: string) {
  uuid(id, "Policy id");
  return run(
    { resource: "pbac", action: "delete", resourceId: id },
    async ({ sql, note }) => {
      const [row] = await sql<
        { name: string }[]
      >`delete from pbac where id = ${id} returning name`;
      if (!row) throw notFound("Policy");
      note({ details: { name: row.name } });
      return { id };
    },
  );
}
