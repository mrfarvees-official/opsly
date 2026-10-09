import "server-only";
import { and, asc, eq, isNull } from "drizzle-orm";
import { hashPassword } from "@/features/auth/infrastructure/password-hasher";
import { appUser, role } from "@/features/auth/infrastructure/schema";
import { primaryDb } from "@/features/database/server/primary-database";
import {
  badRequest,
  conflict,
  forbidden,
  notFound,
  pgCode,
} from "../domain/errors";
import { asObject, email, oneOf, text, uuid } from "../domain/validate";
import { assignTenantRole, getTenantRole, listTenantRoleAssignments, tenantRoleExists } from "./tenant-role-membership";
import { run } from "./run";
import { readSetting } from "./setting-service";

export const ASSIGNABLE_ROLES = ["admin", "member"] as const;
const ROLE_NAMES = { admin: "Admin", member: "Member" } as const;
const BUILTIN_ASSIGNABLE_ROLES = new Set(["admin", "member"]);

export async function ensureRole(key: (typeof ASSIGNABLE_ROLES)[number]) {
  await primaryDb
    .insert(role)
    .values({ key, name: ROLE_NAMES[key] })
    .onConflictDoNothing({ target: role.key });

  const [row] = await primaryDb
    .select()
    .from(role)
    .where(eq(role.key, key))
    .limit(1);
  if (!row) throw new Error(`Role ${key} could not be resolved.`);
  return row;
}

const columns = {
  id: appUser.id,
  email: appUser.email,
  role: role.key,
  status: appUser.status,
  createdAt: appUser.createdAt,
};

function findUser(tenantId: string, id: string) {
  return primaryDb
    .select(columns)
    .from(appUser)
    .innerJoin(role, eq(appUser.roleId, role.id))
    .where(
      and(
        eq(appUser.id, id),
        eq(appUser.tenantId, tenantId),
        isNull(appUser.deletedAt),
      ),
    )
    .limit(1);
}

export async function listUsers() {
  return run({ resource: "user", action: "viewAny" }, async ({ ctx, sql }) => {
    const rows = await primaryDb
      .select(columns)
      .from(appUser)
      .innerJoin(role, eq(appUser.roleId, role.id))
      .where(and(eq(appUser.tenantId, ctx.tenantId), isNull(appUser.deletedAt)))
      .orderBy(asc(appUser.email));
    const assignments = new Map((await listTenantRoleAssignments(sql)).map((row) => [row.user_id, row.role]));
    return rows.map((row) => ({ ...row, role: assignments.get(row.id) ?? row.role }));
  });
}

export async function getUser(id: string) {
  uuid(id, "User id");
  return run(
    {
      resource: "user",
      action: "view",
      resourceId: id,
      attributes: { userId: id },
    },
    async ({ ctx, sql }) => {
      const [user] = await findUser(ctx.tenantId, id);
      if (!user) throw notFound("User");
      return { ...user, role: await getTenantRole(sql, id, user.role) };
    },
  );
}

export async function createUser(input: unknown) {
  const body = asObject(input);
  const userEmail = email(body.email);
  const roleKey = text(body.role ?? "member", "Role", { max: 40 }).toLowerCase();

  return run(
    { resource: "user", action: "create" },
    async ({ ctx, sql, note }) => {
      if (!(await tenantRoleExists(sql, roleKey))) throw badRequest("That role does not exist in this workspace.");
      if (roleKey === "owner") throw badRequest("The owner role can't be assigned.");
      const min = (await readSetting(
        sql,
        "security.minPasswordLength",
      )) as number;
      const password = text(body.password, "Password", { min, max: 200 });

      const roleRow = await ensureRole(BUILTIN_ASSIGNABLE_ROLES.has(roleKey) ? roleKey as "admin" | "member" : "member");
      try {
        const [created] = await primaryDb
          .insert(appUser)
          .values({
            tenantId: ctx.tenantId,
            roleId: roleRow.id,
            email: userEmail,
            passwordHash: await hashPassword(password),
            status: "active",
          })
          .returning({ id: appUser.id });

        note({
          resourceId: created.id,
          details: { email: userEmail, role: roleKey },
        });
        await assignTenantRole(sql, created.id, roleKey, ctx.userId);
        return { id: created.id, email: userEmail, role: roleKey };
      } catch (error) {
        if (pgCode(error) === "23505")
          throw conflict("A user with this email already exists.");
        throw error;
      }
    },
  );
}

export async function updateUser(id: string, input: unknown) {
  uuid(id, "User id");
  const body = asObject(input);

  return run(
    {
      resource: "user",
      action: "update",
      resourceId: id,
      attributes: { userId: id },
    },
    async ({ ctx, sql, note }) => {
      const [target] = await findUser(ctx.tenantId, id);
      if (!target) throw notFound("User");
      if (target.role === "owner" && ctx.userId !== id) throw forbidden();

      const changes: Partial<typeof appUser.$inferInsert> = {
        updatedAt: new Date(),
      };
      const changed: string[] = [];

      if (body.role !== undefined) {
        if (target.role === "owner")
          throw badRequest("The owner's role can't be changed.");
        const roleKey = text(body.role, "Role", { max: 40 }).toLowerCase();
        if (roleKey === "owner" || !(await tenantRoleExists(sql, roleKey))) {
          throw badRequest("That role does not exist in this workspace.");
        }
        if (BUILTIN_ASSIGNABLE_ROLES.has(roleKey)) {
          changes.roleId = (await ensureRole(roleKey as "admin" | "member")).id;
        } else {
          changes.roleId = (await ensureRole("member")).id;
        }
        await assignTenantRole(sql, id, roleKey, ctx.userId);
        changed.push("role");
      }
      if (body.status !== undefined) {
        const status = oneOf(body.status, "Status", [
          "active",
          "disabled",
        ] as const);
        if (id === ctx.userId || target.role === "owner") {
          throw badRequest("You can't disable this account.");
        }
        changes.status = status;
        changed.push("status");
      }
      if (body.password !== undefined) {
        const min = (await readSetting(
          sql,
          "security.minPasswordLength",
        )) as number;
        changes.passwordHash = await hashPassword(
          text(body.password, "Password", { min, max: 200 }),
        );
        changed.push("password");
      }
      if (changed.length === 0) throw badRequest("Nothing to update.");

      await primaryDb
        .update(appUser)
        .set(changes)
        .where(and(eq(appUser.id, id), eq(appUser.tenantId, ctx.tenantId)));

      note({ details: { email: target.email, changed } });
      return { id, changed };
    },
  );
}

export async function deleteUser(id: string) {
  uuid(id, "User id");

  return run(
    {
      resource: "user",
      action: "delete",
      resourceId: id,
      attributes: { userId: id },
    },
    async ({ ctx, sql, note }) => {
      const [target] = await findUser(ctx.tenantId, id);
      if (!target) throw notFound("User");
      if (id === ctx.userId || target.role === "owner") {
        throw badRequest("You can't delete this account.");
      }

      await primaryDb
        .update(appUser)
        .set({
          deletedAt: new Date(),
          status: "disabled",
          updatedAt: new Date(),
        })
        .where(and(eq(appUser.id, id), eq(appUser.tenantId, ctx.tenantId)));
      await sql`delete from team_member where user_id = ${id}`;

      note({ details: { email: target.email } });
      return { id };
    },
  );
}
