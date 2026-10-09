import "server-only";

import { badRequest, notFound } from "../domain/errors";
import { asObject, oneOf, optText, text, uuid } from "../domain/validate";

import { run } from "./run";
import { findTenantUsers } from "./user-directory";

const TEAM_ROLES = ["lead", "member"] as const;

export async function listTeams() {
  return run(
    { resource: "team", action: "viewAny" },
    ({ sql }) => sql`
    select t.id, t.name, t.description, t.created_at,
      (select count(*)::int from team_member m where m.team_id = t.id) as member_count
    from team t
    where t.deleted_at is null
    order by lower(t.name)`,
  );
}

export async function getTeam(id: string) {
  uuid(id, "Team id");
  return run(
    {
      resource: "team",
      action: "view",
      resourceId: id,
      attributes: { teamId: id },
    },
    async ({ ctx, sql }) => {
      const [team] = await sql`
        select id, name, description, created_at, updated_at
        from team where id = ${id} and deleted_at is null`;
      if (!team) throw notFound("Team");

      const members = await sql<
        { user_id: string; role: string; created_at: Date }[]
      >`
        select user_id, role, created_at from team_member
        where team_id = ${id} order by created_at`;
      const users = await findTenantUsers(
        ctx.tenantId,
        members.map((m) => m.user_id),
      );

      return {
        ...team,
        members: members.map((m) => ({
          userId: m.user_id,
          role: m.role,
          email: users.get(m.user_id)?.email ?? null,
          joinedAt: m.created_at,
        })),
      };
    },
  );
}

export async function createTeam(input: unknown) {
  const body = asObject(input);
  const name = text(body.name, "Team name", { max: 100 });
  const description = optText(body.description, "Description");

  return run(
    { resource: "team", action: "create" },
    async ({ ctx, sql, note }) => {
      const [team] = await sql<{ id: string }[]>`
      insert into team (name, description, created_by)
      values (${name}, ${description}, ${ctx.userId}) returning id`;
      note({ resourceId: team.id, details: { name } });
      return { id: team.id };
    },
  );
}

export async function updateTeam(id: string, input: unknown) {
  uuid(id, "Team id");
  const body = asObject(input);
  const name =
    body.name === undefined ? null : text(body.name, "Team name", { max: 100 });
  const hasDescription = body.description !== undefined;
  const description = optText(body.description, "Description");
  if (name === null && !hasDescription) throw badRequest("Nothing to update.");

  return run(
    {
      resource: "team",
      action: "update",
      resourceId: id,
      attributes: { teamId: id },
    },
    async ({ sql, note }) => {
      const [team] = await sql<{ id: string }[]>`
        update team set
          name = coalesce(${name}, name),
          description = case when ${hasDescription} then ${description} else description end,
          updated_at = now()
        where id = ${id} and deleted_at is null
        returning id`;
      if (!team) throw notFound("Team");
      note({ details: { name, descriptionChanged: hasDescription } });
      return { id };
    },
  );
}

export async function deleteTeam(id: string) {
  uuid(id, "Team id");
  return run(
    {
      resource: "team",
      action: "delete",
      resourceId: id,
      attributes: { teamId: id },
    },
    async ({ sql, note }) => {
      const [team] = await sql<{ name: string }[]>`
        update team set deleted_at = now()
        where id = ${id} and deleted_at is null returning name`;
      if (!team) throw notFound("Team");
      note({ details: { name: team.name } });
      return { id };
    },
  );
}

export async function addMember(teamId: string, input: unknown) {
  uuid(teamId, "Team id");
  const body = asObject(input);
  const userId = uuid(body.userId, "User id");
  const role = oneOf(body.role ?? "member", "Team role", TEAM_ROLES);

  return run(
    {
      resource: "team",
      action: "assign",
      resourceId: teamId,
      attributes: { teamId },
    },
    async ({ ctx, sql, note }) => {
      const users = await findTenantUsers(ctx.tenantId, [userId]);
      if (!users.has(userId)) throw notFound("User");

      const [team] =
        await sql`select id from team where id = ${teamId} and deleted_at is null`;
      if (!team) throw notFound("Team");

      await sql`
        insert into team_member (team_id, user_id, role)
        values (${teamId}, ${userId}, ${role})
        on conflict (team_id, user_id) do update set role = excluded.role`;
      note({ details: { op: "add", userId, role } });
      return { teamId, userId, role };
    },
  );
}

export async function removeMember(teamId: string, userId: string) {
  uuid(teamId, "Team id");
  uuid(userId, "User id");

  return run(
    {
      resource: "team",
      action: "assign",
      resourceId: teamId,
      attributes: { teamId },
    },
    async ({ sql, note }) => {
      const rows = await sql`
        delete from team_member where team_id = ${teamId} and user_id = ${userId}
        returning user_id`;
      if (rows.length === 0) throw notFound("Team member");
      note({ details: { op: "remove", userId } });
      return { teamId, userId };
    },
  );
}
