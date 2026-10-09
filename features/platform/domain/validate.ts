import { badRequest } from "./errors";

export function asObject(
  v: unknown,
  what = "Request body",
): Record<string, unknown> {
  if (!v || typeof v !== "object" || Array.isArray(v)) {
    throw badRequest(`${what} must be an object.`);
  }
  return v as Record<string, unknown>;
}

export function text(
  v: unknown,
  field: string,
  o: { min?: number; max?: number } = {},
): string {
  if (typeof v !== "string") throw badRequest(`${field} is required.`);
  const s = v.trim();
  const min = o.min ?? 1;
  const max = o.max ?? 200;
  if (s.length < min) {
    throw badRequest(
      min === 1
        ? `${field} is required.`
        : `${field} must be at least ${min} characters.`,
    );
  }
  if (s.length > max) {
    throw badRequest(`${field} must be at most ${max} characters.`);
  }
  return s;
}

export function int(
  v: unknown,
  field: string,
  min: number,
  max: number,
): number {
  if (typeof v !== "number" || !Number.isInteger(v)) {
    throw badRequest(`${field} must be an integer.`);
  }
  if (v < min || v > max) {
    throw badRequest(`${field} must be between ${min} and ${max}.`);
  }
  return v;
}

export function optText(v: unknown, field: string, max = 1000): string | null {
  if (v === undefined || v === null || v === "") return null;
  return text(v, field, { max });
}

export function oneOf<T extends string>(
  v: unknown,
  field: string,
  allowed: readonly T[],
): T {
  if (typeof v !== "string" || !allowed.includes(v as T)) {
    throw badRequest(`${field} must be one of: ${allowed.join(", ")}.`);
  }
  return v as T;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function uuid(v: unknown, field: string): string {
  if (typeof v !== "string" || !UUID.test(v))
    throw badRequest(`${field} is invalid.`);
  return v;
}

export function list(v: unknown, field: string, max = 50): unknown[] {
  if (v === undefined) return [];
  if (!Array.isArray(v)) throw badRequest(`${field} must be a list.`);
  if (v.length > max)
    throw badRequest(`${field} can have at most ${max} items.`);
  return v;
}

export function email(v: unknown): string {
    const e = text(v, "Email", { max: 254 }).toLocaleLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) throw badRequest("Email is invalid.");
    return e;
}
