import { access } from "fs";

export type Effect = "allow" | "deny";

export type Operator =
  | "eq"
  | "neq"
  | "in"
  | "notIn"
  | "contains"
  | "gt"
  | "gte"
  | "lt"
  | "lte";

export interface PolicySubject {
  kind: "user" | "role" | "team" | "everyone";
  value: string | null;
}

export interface PolicyTarget {
  resource: string;
  action: string;
  resourceId: string | null;
}

export interface PolicyCondition {
  attribute: string;
  operator: Operator;
  value: unknown;
  valueIsAttribute: boolean;
}

export interface Policy {
  id: string;
  name: string;
  description: string | null;
  effect: Effect;
  enabled: boolean;
  subjects: PolicySubject[];
  targets: PolicyTarget[];
  conditions: PolicyCondition[];
}

export interface Subject {
  userId: string;
  email: string;
  role: string;
  teamIds: string;
}

export interface Target {
  resource: string;
  action: string;
  id?: string | null;
  attributes?: Record<string, unknown>;
}

export interface Decision {
  allowed: boolean;
  reason: string;
  policyId?: string;
}

type Scope = Record<string, unknown>;

function resolve(scope: Scope, path: string): unknown {
  return path
    .split(".")
    .reduce<unknown>(
      (acc, key) =>
        acc && typeof acc === "object" ? (acc as Scope)[key] : undefined,
      scope,
    );
}

function compare(op: Operator, left: unknown, right: unknown): boolean {
  switch (op) {
    case "eq":
      return left === right;
    case "neq":
      return left !== right;
    case "in":
      return Array.isArray(right) && right.includes(left);
    case "notIn":
      return Array.isArray(right) && !right.includes(left);
    case "contains":
      if (Array.isArray(left)) return left.includes(right);
      return (
        typeof left === "string" &&
        typeof right === "string" &&
        left.includes(right)
      );
    case "gt":
    case "gte":
    case "lt":
    case "lte": {
      if (typeof left != "number" || typeof right !== "number") return false;
      if (op === "gt") return left > right;
      if (op === "gte") return left >= right;
      if (op === "lt") return left < right;
      return left <= right;
    }
  }
}

/** A condition that can't to be evaluated (missing attribute) is false. */
function holds(c: PolicyCondition, scope: Scope): boolean {
  const left = resolve(scope, c.attribute);
  const right = c.valueIsAttribute ? resolve(scope, String(c.value)) : c.value;
  if (left === undefined || right === undefined) return false;
  return compare(c.operator, left, right);
}

function matchesSubject(s: PolicySubject, subject: Subject): boolean {
  switch (s.kind) {
    case "everyone":
      return true;
    case "user":
      return s.value === subject.userId;
    case "role":
      return s.value === subject.role;
    case "team":
      return !!s.value && subject.teamIds.includes(s.value);
  }
}

function matchesTarget(t: PolicyTarget, target: Target): boolean {
  return (
    (t.resource === "*" || t.resource === target.resource) &&
    (t.action === "*" || t.action === target.action) &&
    (t.resourceId === null || t.resourceId === target.id)
  );
}

/** Deny overrides allow. No matching policy means deny. */
export function decide(
  policies: Policy[],
  subject: Subject,
  target: Target,
  now = new Date(),
): Decision {
  const scope: Scope = {
    subject,
    target: {
      ...target.attributes,
      id: target.id ?? undefined,
      resource: target.resource,
      action: target.action,
    },
    env: { hour: now.getUTCHours(), weekday: now.getUTCDay() },
  };

  const applicable = policies.filter(
    (p) =>
      p.enabled &&
      p.subjects.some((s) => matchesSubject(s, subject)) &&
      p.targets.some((t) => matchesTarget(t, target)) &&
      p.conditions.every((c) => holds(c, scope)),
  );

  const deny = applicable.find((p) => p.effect === "deny");

  if (deny) {
    return {
      allowed: false,
      reason: `Denied by policy "${deny.name}".`,
      policyId: deny.id,
    };
  }

  const allow = applicable.find((p) => p.effect === "allow");

  if (allow) {
    return {
      allowed: true,
      reason: `Allowed by policy "${allow.name}".`,
      policyId: allow.id,
    };
  }

  return { allowed: false, reason: "No policy allow this action." };
}
