import {
  boolean,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const tenantStatusEnum = pgEnum("tenant_status", [
  "active",
  "suspended",
  "disabled",
]);

export const tenantDatabaseStatusEnum = pgEnum("tenant_database_status", [
  "active",
  "disabled",
]);

export const tenantDatabaseRoleEnum = pgEnum("tenant_database_role", [
  "primary",
  "replica",
]);

export const tenant = pgTable("tenant", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  status: tenantStatusEnum("status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

export const tenantDatabase = pgTable("tenant_database", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenant.id, { onDelete: "cascade" }),
  role: tenantDatabaseRoleEnum("role").notNull().default("primary"),
  status: tenantDatabaseStatusEnum("status").notNull().default("active"),
  host: text("host").notNull(),
  port: integer("port").notNull().default(5432),
  database: text("database").notNull(),
  username: text("username").notNull(),
  password: text("password").notNull(),
  ssl: boolean("ssl").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});
