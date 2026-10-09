import "server-only";

import { badRequest, notFound } from "../domain/errors";
import { asObject, optText, text } from "../domain/validate";

import { run } from "./run";

const KEY = /^[a-z][a-z0-9_]{1,39}$/;

export async function listRoles() {
  return run({ resource: "role", action: "viewAny" }, ({ sql }) =>
    sql`select id, key, name, description, system, created_at from workspace_role order by system desc, name`,
  );
}

export async function createRole(input: unknown) {
  const body = asObject(input);
  const key = text(body.key, "Role key", { max: 40 }).toLowerCase();
  if (!KEY.test(key)) throw badRequest("Role key must use lowercase letters, numbers and underscores.");
  const name = text(body.name, "Role name", { max: 100 });
  const description = optText(body.description, "Description");

  return run({ resource: "role", action: "create", resourceId: key }, async ({ sql, note }) => {
    await sql`
      insert into workspace_role (key, name, description)
      values (${key}, ${name}, ${description})`;
    note({ resourceId: key, details: { key, name } });
    return { key };
  });
}

export async function updateRole(key: string, input: unknown) {
  const body = asObject(input);
  const name = body.name === undefined ? null : text(body.name, "Role name", { max: 100 });
  const hasDescription = body.description !== undefined;
  const description = optText(body.description, "Description");
  if (name === null && !hasDescription) throw badRequest("Nothing to update.");

  return run({ resource: "role", action: "update", resourceId: key }, async ({ sql, note }) => {
    const rows = await sql<{ system: boolean }[]>`
      update workspace_role set
        name = coalesce(${name}, name),
        description = case when ${hasDescription} then ${description} else description end,
        updated_at = now()
      where key = ${key}
      returning system`;
    if (rows.length === 0) throw notFound("Role");
    note({ resourceId: key, details: { name, descriptionChanged: hasDescription } });
    return { key };
  });
}

export async function deleteRole(key: string) {
  return run({ resource: "role", action: "delete", resourceId: key }, async ({ sql, note }) => {
    const [row] = await sql<{ system: boolean }[]>`
      select system from workspace_role where key = ${key}`;
    if (!row) throw notFound("Role");
    if (row.system) throw badRequest("Built-in roles can't be deleted.");
    await sql`delete from workspace_role where key = ${key}`;
    note({ resourceId: key, details: { key } });
    return { key };
  });
}
