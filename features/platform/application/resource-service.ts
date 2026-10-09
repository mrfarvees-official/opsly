import "server-only";

import { badRequest, notFound } from "../domain/errors";
import { asObject, optText, text } from "../domain/validate";

import { run } from "./run";

const KEY = /^[a-z][a-z0-9_]{1,39}$/;

export async function listResources() {
  return run(
    { resource: "resource", action: "viewAny" },
    ({ sql }) =>
      sql`select key, name, description, system, created_at from resource order by system desc, key`,
  );
}

export async function listActions() {
  return run(
    { resource: "action", action: "viewAny" },
    ({ sql }) => sql`select key, name, logged from action order by key`,
  );
}

export async function createResource(input: unknown) {
  const body = asObject(input);
  const key = text(body.key, "Key", { max: 40 });
  if (!KEY.test(key)) {
    throw badRequest(
      "Key must start with a letter and use only lowercase letters, numbers and underscores.",
    );
  }
  const name = text(body.name, "Name", { max: 100 });
  const description = optText(body.description, "Description");

  return run(
    { resource: "resource", action: "create", resourceId: key },
    async ({ sql, note }) => {
      await sql`insert into resource (key, name, description) values (${key}, ${name}, ${description})`;
      note({ details: { key, name } });
      return { key };
    },
  );
}

export async function updateResource(key: string, input: unknown) {
  const body = asObject(input);
  const name =
    body.name === undefined ? null : text(body.name, "Name", { max: 100 });
  const hasDescription = body.description !== undefined;
  const description = optText(body.description, "Description");
  if (name === null && !hasDescription) throw badRequest("Nothing to update.");

  return run(
    { resource: "resource", action: "update", resourceId: key },
    async ({ sql, note }) => {
      const rows = await sql`
      update resource set
        name = coalesce(${name}, name),
        description = case when ${hasDescription} then ${description} else description end
      where key = ${key} returning key`;
      if (rows.length === 0) throw notFound("Resource");
      note({ details: { name, descriptionChanged: hasDescription } });
      return { key };
    },
  );
}

export async function deleteResource(key: string) {
  return run(
    { resource: "resource", action: "delete", resourceId: key },
    async ({ sql, note }) => {
      const [row] = await sql<
        { system: boolean }[]
      >`select system from resource where key = ${key}`;
      if (!row) throw notFound("Resource");
      if (row.system) throw badRequest("System resources can't be deleted.");
      await sql`delete from resource where key = ${key}`;
      note({ details: { key } });
      return { key };
    },
  );
}
