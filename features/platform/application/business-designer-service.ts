import "server-only";

import { badRequest, notFound } from "../domain/errors";
import { asObject, optText, text } from "../domain/validate";
import { run } from "./run";

const KEY = /^[a-z][a-z0-9_]{1,39}$/;
const FIELD_TYPES = {
  text: "text",
  number: "numeric",
  boolean: "boolean",
  date: "date",
  datetime: "timestamptz",
  uuid: "uuid",
  json: "jsonb",
} as const;

type Field = {
  key: string;
  name?: string;
  label?: string;
  description?: string;
  type?: keyof typeof FIELD_TYPES;
  input?: string;
  placeholder?: string;
  example?: string;
  unit?: string;
  options?: string[];
  jsonMode?: "object" | "list";
  jsonSchema?: unknown;
  required?: boolean;
  searchable?: boolean;
  sensitive?: boolean;
  reference?: { path?: string; targetResource: string; targetField?: string; displayField?: string; allowMany?: boolean };
  calculation?: { path?: string; operation: string; sourceResource: string; sourceField?: string; valueField?: string; matchLocalField?: string; matchSourceField?: string; operands?: unknown[]; refreshMode?: "on_read" | "on_write" | "scheduled" | "materialized" };
  properties?: Field[];
};
type Table = { key: string; name: string; kind?: "table" | "derived"; fields?: Field[] };

function identifier(value: unknown, label: string) {
  const result = text(value, label, { max: 40 });
  if (!KEY.test(result)) throw badRequest(`${label} must use lowercase letters, numbers and underscores.`);
  return result;
}

function parseTables(value: unknown): Table[] {
  if (!Array.isArray(value) || value.length === 0) throw badRequest("Add at least one business table.");
  return value.map((raw, index) => {
    const table = asObject(raw, `Table ${index + 1}`);
    const key = identifier(table.key, `Table ${index + 1} key`);
    const name = text(table.name ?? key, `Table ${index + 1} name`, { max: 100 });
    const fields = table.fields === undefined ? [] : table.fields;
    if (!Array.isArray(fields)) throw badRequest(`Fields for ${key} must be a list.`);
    return {
      key,
      name,
      kind: table.kind === "derived" ? "derived" : "table",
      fields: fields.map((rawField, fieldIndex) => {
        const field = asObject(rawField, `Field ${fieldIndex + 1}`);
        const fieldKey = identifier(field.key, `Field ${fieldIndex + 1} key`);
        const type = (field.type ?? "text") as keyof typeof FIELD_TYPES;
        if (!FIELD_TYPES[type]) throw badRequest(`Unsupported type for ${key}.${fieldKey}.`);
        const options = Array.isArray(field.options) ? field.options.map((option) => text(option, "Option", { max: 100 })) : undefined;
        const jsonMode = field.jsonMode === "list" ? "list" : "object";
        if (field.input === "select" && (!options || options.length === 0)) throw badRequest(`${key}.${fieldKey} needs at least one choice.`);
        const reference = field.reference && typeof field.reference === "object" ? asObject(field.reference, `${key}.${fieldKey} reference`) : undefined;
        const calculation = field.calculation && typeof field.calculation === "object" ? asObject(field.calculation, `${key}.${fieldKey} calculation`) : undefined;
        if (reference && typeof reference.targetResource !== "string") throw badRequest(`${key}.${fieldKey} needs a reference target resource.`);
        if (calculation && (typeof calculation.sourceResource !== "string" || typeof calculation.operation !== "string")) throw badRequest(`${key}.${fieldKey} needs a calculation source and operation.`);
        const operation = typeof calculation?.operation === "string" ? calculation.operation : "lookup";
        if (calculation && !/^[a-z][a-z0-9_]{1,39}$/.test(operation)) throw badRequest(`${key}.${fieldKey} has an invalid calculation operation name.`);
        return {
          key: fieldKey,
          name: optText(field.name, "Field name") ?? fieldKey,
          label: optText(field.label, "Field label") ?? optText(field.name, "Field name") ?? fieldKey,
          description: optText(field.description, "Field description") ?? undefined,
          type,
          input: optText(field.input, "Input type") ?? (type === "json" ? "json_builder" : type === "boolean" ? "checkbox" : type === "date" ? "date" : type === "datetime" ? "datetime" : "text"),
          placeholder: optText(field.placeholder, "Placeholder") ?? undefined,
          example: optText(field.example, "Example") ?? undefined,
          unit: optText(field.unit, "Unit") ?? undefined,
          options,
          jsonMode: type === "json" ? jsonMode : undefined,
          jsonSchema: type === "json" && field.jsonSchema && typeof field.jsonSchema === "object" ? field.jsonSchema : undefined,
          required: Boolean(field.required),
          searchable: Boolean(field.searchable),
          sensitive: Boolean(field.sensitive),
          reference: reference ? { path: typeof reference.path === "string" ? reference.path : "$", targetResource: String(reference.targetResource), targetField: typeof reference.targetField === "string" ? reference.targetField : "id", displayField: typeof reference.displayField === "string" ? reference.displayField : undefined, allowMany: Boolean(reference.allowMany) } : undefined,
          calculation: calculation ? { path: typeof calculation.path === "string" ? calculation.path : "$", operation: operation!, sourceResource: String(calculation.sourceResource), sourceField: typeof calculation.sourceField === "string" ? calculation.sourceField : undefined, valueField: typeof calculation.valueField === "string" ? calculation.valueField : undefined, matchLocalField: typeof calculation.matchLocalField === "string" ? calculation.matchLocalField : undefined, matchSourceField: typeof calculation.matchSourceField === "string" ? calculation.matchSourceField : undefined, operands: Array.isArray(calculation.operands) ? calculation.operands : undefined, refreshMode: calculation.refreshMode === "on_write" || calculation.refreshMode === "scheduled" || calculation.refreshMode === "materialized" ? calculation.refreshMode : "on_read" } : undefined,
        };
      }),
    };
  });
}

function physicalName(businessKey: string, tableKey: string) {
  return `biz_${businessKey}_${tableKey}`;
}

function quoteIdentifier(value: string) {
  if (!/^[a-z][a-z0-9_]{1,63}$/.test(value)) throw badRequest("Reference identifiers are invalid.");
  return `"${value}"`;
}

async function createPhysicalTable(sql: any, table: Table) {
  const physical = `biz_${table.key}`;
  const columns = (table.fields ?? []).map((field) =>
    `"${field.key}" ${FIELD_TYPES[field.type ?? "text"]}${field.required ? " not null" : ""}`,
  );
  const definition = [
    `"id" uuid primary key default gen_random_uuid()`,
    ...columns,
    `"created_at" timestamptz not null default now()`,
    `"updated_at" timestamptz not null default now()`,
  ].join(", ");
  await sql.unsafe(`create table if not exists "${physical}" (${definition})`);
  return physical;
}

export async function listBusinessDefinitions() {
  return run({ resource: "business_definition", action: "viewAny" }, ({ sql }) => sql`
    select b.id, b.key, b.name, b.description, b.status, b.version, b.updated_at,
      count(t.id)::int as table_count
    from business_definition b left join business_table t on t.business_id = b.id
    group by b.id order by b.updated_at desc
  `);
}

export async function getBusinessDefinition(id: string) {
  return run({ resource: "business_definition", action: "view", resourceId: id }, async ({ sql }) => {
    const [business] = await sql`select id, key, name, description, status, version, created_at, updated_at from business_definition where id = ${id}`;
    if (!business) throw notFound("Business definition");
    const tables = await sql`select id, key, name, kind, physical_table, definition, position from business_table where business_id = ${id} order by position, name`;
    const calculations = await sql`select id, target_table_id, key, name, expression, dependencies from business_calculation where business_id = ${id} order by name`;
    return { ...business, tables, calculations };
  });
}

export async function createBusinessDefinition(input: unknown) {
  const body = asObject(input);
  const key = identifier(body.key, "Key");
  const name = text(body.name, "Name", { max: 100 });
  const description = optText(body.description, "Description");
  const tables = parseTables(body.tables);
  const calculation = body.calculation ? asObject(body.calculation, "Calculation") : null;

  return run({ resource: "business_definition", action: "create", resourceId: key }, async ({ sql, ctx, note }) => {
    const [business] = await sql`insert into business_definition (key, name, description, created_by) values (${key}, ${name}, ${description}, ${ctx.userId}) returning id, key`;
    const resourceForTable = new Map(tables.map((table) => [table.key, `${key}_${table.key}`]));
    for (const [position, table] of tables.entries()) {
      const resourceKey = `${key}_${table.key}`;
      const physical = await createPhysicalTable(sql, { ...table, key: `${key}_${table.key}` });
      await sql`insert into resource (key, name, description, sidebar_visible, sidebar_order, route_path, requires_explicit_policy) values (${resourceKey}, ${table.name}, ${description}, true, ${position + 20}, ${`/dashboard/data/${resourceKey}`}, true)`;
      const [tableRow] = await sql`insert into business_table (business_id, resource_key, key, name, physical_table, kind, definition, position) values (${business.id}, ${resourceKey}, ${table.key}, ${table.name}, ${physical}, ${table.kind ?? "table"}, ${JSON.stringify({ fields: table.fields ?? [] })}, ${position}) returning id`;
      for (const [fieldPosition, field] of (table.fields ?? []).entries()) {
        const [fieldRow] = await sql`insert into business_field (table_id, key, label, data_type, input_type, required, searchable, sensitive, definition, position) values (${tableRow.id}, ${field.key}, ${field.label ?? field.name ?? field.key}, ${field.type ?? "text"}, ${field.input ?? "text"}, ${Boolean(field.required)}, ${Boolean(field.searchable)}, ${Boolean(field.sensitive)}, ${JSON.stringify(field)}, ${fieldPosition}) returning id`;
        if (field.reference) await sql`insert into business_field_reference (field_id, path, target_resource, target_field, display_field, allow_many) values (${fieldRow.id}, ${field.reference.path ?? "$"}, ${resourceForTable.get(field.reference.targetResource) ?? field.reference.targetResource}, ${field.reference.targetField ?? "id"}, ${field.reference.displayField ?? null}, ${Boolean(field.reference.allowMany)})`;
        if (field.calculation) await sql`insert into business_field_calculation (field_id, path, operation, source_resource, source_field, match_local_field, match_source_field, expression, refresh_mode) values (${fieldRow.id}, ${field.calculation.path ?? "$"}, ${field.calculation.operation}, ${resourceForTable.get(field.calculation.sourceResource) ?? field.calculation.sourceResource}, ${field.calculation.sourceField ?? null}, ${field.calculation.matchLocalField ?? null}, ${field.calculation.matchSourceField ?? null}, ${JSON.stringify({ ...field.calculation, sourceResource: resourceForTable.get(field.calculation.sourceResource) ?? field.calculation.sourceResource, operands: field.calculation.operands?.map((operand: any) => ({ ...operand, table: operand.table ? resourceForTable.get(operand.table) ?? operand.table : operand.table })) })}, ${field.calculation.refreshMode ?? "on_read"})`;
      }
    }

    const references = await sql<{ table_name: string; field_key: string; data_type: string; target_resource: string; target_field: string; target_table: string | null; allow_many: boolean; path: string }[]>`
      select source_table.physical_table as table_name, field.key as field_key, field.data_type,
        reference.target_resource, reference.target_field, target_table.physical_table as target_table,
        reference.allow_many, reference.path
      from business_field_reference reference
      join business_field field on field.id = reference.field_id
      join business_table source_table on source_table.id = field.table_id
      left join business_table target_table on target_table.resource_key = reference.target_resource
      where source_table.business_id = ${business.id}`;
    for (const reference of references) {
      if (!reference.target_table) throw badRequest(`Reference target ${reference.target_resource} must be a business table.`);
      if (reference.path !== "$" || reference.allow_many) continue;
      if (reference.data_type !== "uuid" || reference.target_field !== "id") throw badRequest(`${reference.field_key} must be a UUID field pointing to the target record id.`);
      const constraint = `fk_${reference.table_name}_${reference.field_key}`;
      await sql.unsafe(`alter table ${quoteIdentifier(reference.table_name)} add constraint ${quoteIdentifier(constraint)} foreign key (${quoteIdentifier(reference.field_key)}) references ${quoteIdentifier(reference.target_table)} (${quoteIdentifier(reference.target_field)}) on delete restrict`);
    }
    if (calculation) {
      const target = identifier(calculation.targetTable, "Calculation target table");
      const tableRow = await sql`select id from business_table where business_id = ${business.id} and key = ${target}`;
      if (!tableRow[0]) throw badRequest("Calculation target table was not found.");
      await sql`insert into business_calculation (business_id, target_table_id, key, name, expression, dependencies) values (${business.id}, ${tableRow[0].id}, ${identifier(calculation.key, "Calculation key")}, ${text(calculation.name, "Calculation name", { max: 100 })}, ${text(calculation.expression, "Calculation expression", { max: 500 })}, ${JSON.stringify(Array.isArray(calculation.dependencies) ? calculation.dependencies : [])})`;
    }
    note({ resourceId: business.id, details: { key, tableCount: tables.length, physicalTables: tables.map((table) => physicalName(key, table.key)), calculation: Boolean(calculation) } });
    return { id: business.id, key };
  });
}

export async function createBusinessSnapshot(id: string, label: string) {
  return run({ resource: "business_definition", action: "export", resourceId: id }, async ({ sql, ctx, note }) => {
    const [business] = await sql`select id from business_definition where id = ${id}`;
    if (!business) throw notFound("Business definition");
    const tables = await sql<{ id: string; physical_table: string }[]>`select id, physical_table from business_table where business_id = ${id}`;
    const created = [];
    for (const table of tables) {
      const [{ count }] = await sql.unsafe(`select count(*)::bigint as count from "${table.physical_table}"`) as { count: string }[];
      const [snapshot] = await sql`insert into business_snapshot (business_id, label, table_name, row_count, created_by) values (${id}, ${label}, ${table.physical_table}, ${count}, ${ctx.userId}) returning id`;
      created.push(snapshot.id);
    }
    note({ details: { label, tableCount: tables.length, snapshotIds: created } });
    return { ids: created };
  });
}

type BusinessTableOptions = { page?: number; pageSize?: number; search?: string };

async function businessTable(sql: any, resourceKey: string) {
  const [table] = await sql<{ id: string; physical_table: string; name: string; definition: { fields?: Field[] } }[]>`select id, physical_table, name, definition from business_table where resource_key = ${resourceKey}`;
  if (!table) throw notFound("Business table");
  return table;
}

function tableFieldKeys(table: { definition: { fields?: Field[] } }) {
  return (table.definition.fields ?? []).map((field) => field.key).filter((key) => KEY.test(key));
}

async function hydrateCalculatedRows(sql: any, table: { id: string }, rows: Record<string, unknown>[]) {
  const calculations = await sql<{ field_key: string; operation: string; expression: { operands?: { source: string; field?: string; table?: string; through?: string; value?: string }[] } }[]>`
    select field.key as field_key, calculation.operation, calculation.expression
    from business_field_calculation calculation
    join business_field field on field.id = calculation.field_id
    where field.table_id = ${table.id}`;
  for (const calculation of calculations) {
    for (const row of rows) {
      const values: number[] = [];
      for (const operand of calculation.expression?.operands ?? []) {
        if (operand.source === "constant") {
          values.push(Number(operand.value ?? 0));
        } else if (operand.source === "current") {
          values.push(Number(row[operand.field ?? ""] ?? 0));
        } else if (operand.source === "related" && operand.table && operand.through && operand.field) {
          const [target] = await sql<{ physical_table: string }[]>`select physical_table from business_table where resource_key = ${operand.table}`;
          if (!target) { values.push(0); continue; }
          const [related] = await sql<{ value: unknown }[]>`select ${sql(operand.field)} as value from ${sql(target.physical_table)} where id = ${row[operand.through]}`;
          values.push(Number(related?.value ?? 0));
        }
      }
      row[calculation.field_key] = calculateOperation(calculation.operation, values);
    }
  }
  return rows;
}

function calculateOperation(operation: string, values: number[]) {
  if (values.length === 0) return null;
  if (operation === "add" || operation === "sum") return values.reduce((total, value) => total + value, 0);
  if (operation === "subtract") return values.slice(1).reduce((total, value) => total - value, values[0]);
  if (operation === "multiply") return values.reduce((total, value) => total * value, 1);
  if (operation === "divide") return values.slice(1).some((value) => value === 0) ? null : values.slice(1).reduce((total, value) => total / value, values[0]);
  if (operation === "min") return Math.min(...values);
  if (operation === "max") return Math.max(...values);
  if (operation === "avg") return values.reduce((total, value) => total + value, 0) / values.length;
  if (operation === "count") return values.length;
  return values[0];
}

export async function listBusinessTableRows(resourceKey: string, options: BusinessTableOptions = {}) {
  return run({ resource: resourceKey, action: "viewAny" }, async ({ sql }) => {
    const table = await businessTable(sql, resourceKey);
    const page = Math.max(1, Math.floor(options.page ?? 1));
    const pageSize = Math.min(100, Math.max(10, Math.floor(options.pageSize ?? 25)));
    const search = String(options.search ?? "").trim();
    const fields = tableFieldKeys(table);
    const searchable = fields.filter((field) => table.definition.fields?.find((item: Field) => item.key === field)?.type !== "json");
    const where = search && searchable.length ? `where concat_ws(' ', ${searchable.map((field) => `"${field}"::text`).join(", ")}) ilike $1` : "";
    const values = search && searchable.length ? [`%${search}%`] : [];
    const countRows = await sql.unsafe(`select count(*)::int as count from "${table.physical_table}" ${where}`, values) as { count: number }[];
    const rows = await sql.unsafe(`select * from "${table.physical_table}" ${where} order by "created_at" desc limit ${pageSize} offset ${(page - 1) * pageSize}`, values) as Record<string, unknown>[];
    await hydrateCalculatedRows(sql, table, rows);
    const references = await sql<{ field_key: string; target_resource: string; target_field: string; display_field: string | null; allow_many: boolean; physical_table: string }[]>`
      select field.key as field_key, reference.target_resource, reference.target_field,
        reference.display_field, reference.allow_many, target_table.physical_table
      from business_field_reference reference
      join business_field field on field.id = reference.field_id
      join business_table target_table on target_table.resource_key = reference.target_resource
      where field.table_id = ${table.id}`;
    const referenceOptions: Record<string, { id: string; label: string }[]> = {};
    for (const reference of references) {
      const display = reference.display_field && KEY.test(reference.display_field) ? reference.display_field : reference.target_field;
      const options = await sql.unsafe(`select ${quoteIdentifier(reference.target_field)} as id, ${quoteIdentifier(display)} as label from ${quoteIdentifier(reference.physical_table)} order by ${quoteIdentifier(display)} limit 500`) as { id: string; label: string }[];
      referenceOptions[reference.field_key] = options.map((option) => ({ id: String(option.id), label: String(option.label ?? option.id) }));
    }
    return { ...table, rows, page, pageSize, total: Number(countRows[0]?.count ?? 0), fields: table.definition.fields ?? [], referenceOptions };
  });
}

async function writableColumns(sql: any, table: { id: string; definition: { fields?: Field[] } }, payload: Record<string, unknown>) {
  const fields = table.definition.fields ?? [];
  const allowed = new Set(fields.filter((field) => !field.calculation).map((field) => field.key));
  const columns = Object.keys(payload).filter((column) => allowed.has(column) && KEY.test(column));
  for (const field of fields) if (field.required && !field.calculation && (payload[field.key] === undefined || payload[field.key] === null || payload[field.key] === "")) throw badRequest(`${field.label ?? field.key} is required.`);
  if (columns.length === 0) throw badRequest("Add at least one value.");
  return columns;
}

export async function getBusinessRecord(resourceKey: string, id: string) {
  return run({ resource: resourceKey, action: "view", resourceId: id }, async ({ sql }) => {
    const table = await businessTable(sql, resourceKey);
    const rows = await sql`select * from ${sql(table.physical_table)} where id = ${id}` as Record<string, unknown>[];
    if (!rows[0]) throw notFound("Business record");
    await hydrateCalculatedRows(sql, table, rows);
    return { ...table, fields: table.definition.fields ?? [], row: rows[0] };
  });
}

export async function updateBusinessRecord(resourceKey: string, id: string, input: unknown) {
  const payload = asObject(input, "Record");
  return run({ resource: resourceKey, action: "update", resourceId: id }, async ({ sql, note }) => {
    const table = await businessTable(sql, resourceKey);
    const columns = await writableColumns(sql, table, payload);
    const row = await sql`update ${sql(table.physical_table)} set ${sql(payload, ...columns)}, "updated_at" = now() where id = ${id} returning *`;
    if (!row[0]) throw notFound("Business record");
    note({ details: { resourceKey, columns } });
    return row[0];
  });
}

export async function deleteBusinessRecord(resourceKey: string, id: string) {
  return run({ resource: resourceKey, action: "delete", resourceId: id }, async ({ sql, note }) => {
    const table = await businessTable(sql, resourceKey);
    const row = await sql`delete from ${sql(table.physical_table)} where id = ${id} returning id`;
    if (!row[0]) throw notFound("Business record");
    note({ details: { resourceKey } });
    return { id };
  });
}

type RuleSql = { unsafe: (query: string, values?: unknown[]) => Promise<unknown>; (strings: TemplateStringsArray, ...values: unknown[]): Promise<any> };

/**
 * Runs cross-resource invariants inside the caller's transaction. Stock rules
 * lock the source row before reading it, preventing overselling under concurrency.
 */
export async function validateBusinessRules(sql: RuleSql, resourceKey: string, action: "create" | "update" | "delete", payload: Record<string, unknown>) {
  const rules = await sql`select kind, definition, error_message from business_rule where event_resource = ${resourceKey} and event_action = ${action} and enabled = true` as { kind: string; definition: Record<string, unknown>; error_message: string }[];
  for (const rule of rules) {
    if (rule.kind !== "stock_guard") continue;
    const definition = rule.definition ?? {};
    const stockResource = String(definition.stockResource ?? "");
    const stockKeyField = String(definition.stockKeyField ?? "item_id");
    const stockValueField = String(definition.stockValueField ?? "available");
    const quantityField = String(definition.quantityField ?? "qty");
    if (!KEY.test(stockKeyField) || !KEY.test(stockValueField) || !KEY.test(quantityField)) throw badRequest("The stock rule has an invalid field mapping.");
    const [stock] = await sql`select physical_table from business_table where resource_key = ${stockResource}` as { physical_table: string }[];
    if (!stock) throw badRequest(`Stock resource ${stockResource} was not found.`);
    const lookupValue = payload[String(definition.orderKeyField ?? stockKeyField)];
    const quantity = Number(payload[quantityField]);
    if (lookupValue === undefined || !Number.isFinite(quantity) || quantity <= 0) throw badRequest(rule.error_message);
    const rows = await sql.unsafe(`select ${quoteIdentifier(stockValueField)} as available from ${quoteIdentifier(stock.physical_table)} where ${quoteIdentifier(stockKeyField)} = $1 for update`, [lookupValue]) as { available: number }[];
    if (!rows[0] || Number(rows[0].available) < quantity) throw badRequest(rule.error_message);
    if (action === "create" && definition.consume !== false) {
      await sql.unsafe(`update ${quoteIdentifier(stock.physical_table)} set ${quoteIdentifier(stockValueField)} = ${quoteIdentifier(stockValueField)} - $1, "updated_at" = now() where ${quoteIdentifier(stockKeyField)} = $2`, [quantity, lookupValue]);
    }
  }
}

export async function createBusinessRecord(resourceKey: string, input: unknown) {
  const payload = asObject(input, "Record");
  return run({ resource: resourceKey, action: "create" }, async ({ sql, note }) => {
    const table = await businessTable(sql, resourceKey);
    await validateBusinessRules(sql as unknown as RuleSql, resourceKey, "create", payload);
    const columns = await writableColumns(sql, table, payload);
    const row = await sql`insert into ${sql(table.physical_table)} ${sql(payload, ...columns)} returning *`;
    note({ details: { resourceKey, columns } });
    return row[0];
  });
}

export async function createBusinessRule(input: unknown) {
  const body = asObject(input);
  const businessKey = identifier(body.businessKey, "Business key");
  const name = text(body.name, "Rule name", { max: 100 });
  const eventResource = identifier(body.eventResource, "Event resource");
  const eventAction = body.eventAction === "update" || body.eventAction === "delete" ? body.eventAction : "create";
  const kind = body.kind === "stock_guard" || body.kind === "workflow" ? body.kind : "validation";
  const errorMessage = text(body.errorMessage, "Error message", { max: 240 });
  const definition = body.definition && typeof body.definition === "object" ? body.definition : {};
  return run({ resource: "business_definition", action: "update", resourceId: businessKey }, async ({ sql, note }) => {
    const [business] = await sql`select id from business_definition where key = ${businessKey}`;
    if (!business) throw notFound("Business definition");
    const [rule] = await sql`insert into business_rule (business_id, name, event_resource, event_action, kind, definition, error_message) values (${business.id}, ${name}, ${eventResource}, ${eventAction}, ${kind}, ${JSON.stringify(definition)}, ${errorMessage}) returning id`;
    note({ resourceId: rule.id, details: { name, eventResource, eventAction, kind } });
    return rule;
  });
}
