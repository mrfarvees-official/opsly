import {
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { tenant } from "@/features/tenant/infrastructure/schema";

export const userStatusEnum = pgEnum("user_status", ["active", "disabled"]);

export const role = pgTable("role", {
  id: uuid("id").defaultRandom().primaryKey(),

  key: text("key").notNull().unique(),

  name: text("name").notNull(),

  createdAt: timestamp("created_at", {
    withTimezone: true,
  })
    .notNull()
    .defaultNow(),

  updatedAt: timestamp("updated_at", {
    withTimezone: true,
  })
    .notNull()
    .defaultNow(),
});

export const appUser = pgTable(
  "app_user",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenant.id, {
        onDelete: "cascade",
      }),

    roleId: uuid("role_id")
      .notNull()
      .references(() => role.id),

    email: text("email").notNull(),

    passwordHash: text("password_hash").notNull(),

    status: userStatusEnum("status").notNull().default("active"),

    createdAt: timestamp("created_at", {
      withTimezone: true,
    })
      .notNull()
      .defaultNow(),

    updatedAt: timestamp("updated_at", {
      withTimezone: true,
    })
      .notNull()
      .defaultNow(),

    deletedAt: timestamp("deleted_at", {
      withTimezone: true,
    }),
  },
  (table) => ({
    tenantEmailUnique: uniqueIndex("app_user_tenant_email_unique").on(
      table.tenantId,
      table.email,
    ),
  }),
);
