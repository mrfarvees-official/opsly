/**
 * Append-only tenant migrations. IDs must stay strictly increasing. Never
 * edit or delete a shipped migration; the baseline DDL in tenant-sql.ts is
 * frozen and all later tenant schema changes belong here.
 */
export interface TenantMigration {
  id: number;
  name: string;
  sql: string;
}

export const MIGRATIONS: TenantMigration[] = [
  {
    id: 1,
    name: "add tenant roles and role assignments",
    sql: `
      create table if not exists workspace_role (
        id uuid primary key default gen_random_uuid(),
        key text not null unique,
        name text not null,
        description text,
        system boolean not null default false,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      );
      create table if not exists workspace_role_member (
        user_id uuid primary key,
        role_id uuid not null references workspace_role(id) on delete restrict,
        assigned_by uuid,
        assigned_at timestamptz not null default now()
      );
      create index if not exists workspace_role_member_role on workspace_role_member (role_id);
    `,
  },
  {
    id: 2,
    name: "add business designer definitions and physical table bindings",
    sql: `
      alter table resource add column if not exists sidebar_visible boolean not null default true;
      alter table resource add column if not exists sidebar_order integer not null default 100;
      alter table resource add column if not exists route_path text;

      create table if not exists business_definition (
        id uuid primary key default gen_random_uuid(),
        key text not null unique,
        name text not null,
        description text,
        status text not null default 'draft' check (status in ('draft','published','archived')),
        version integer not null default 1,
        created_by uuid,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      );

      create table if not exists business_table (
        id uuid primary key default gen_random_uuid(),
        business_id uuid not null references business_definition(id) on delete cascade,
        resource_key text not null unique references resource(key) on delete restrict,
        key text not null,
        name text not null,
        physical_table text not null unique,
        kind text not null default 'table' check (kind in ('table','derived')),
        definition jsonb not null default '{}'::jsonb,
        position integer not null default 100,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now(),
        unique (business_id, key)
      );

      create table if not exists business_relation (
        id uuid primary key default gen_random_uuid(),
        business_id uuid not null references business_definition(id) on delete cascade,
        from_table_id uuid not null references business_table(id) on delete cascade,
        to_table_id uuid not null references business_table(id) on delete cascade,
        from_field text not null,
        to_field text not null,
        relation_type text not null default 'many_to_one' check (relation_type in ('one_to_one','one_to_many','many_to_one','many_to_many')),
        created_at timestamptz not null default now()
      );

      create table if not exists business_calculation (
        id uuid primary key default gen_random_uuid(),
        business_id uuid not null references business_definition(id) on delete cascade,
        target_table_id uuid not null references business_table(id) on delete cascade,
        key text not null,
        name text not null,
        expression text not null,
        dependencies jsonb not null default '[]'::jsonb,
        created_at timestamptz not null default now(),
        unique (target_table_id, key)
      );

      create table if not exists business_snapshot (
        id uuid primary key default gen_random_uuid(),
        business_id uuid not null references business_definition(id) on delete cascade,
        label text not null,
        table_name text not null,
        row_count bigint not null default 0,
        storage_key text,
        created_by uuid,
        created_at timestamptz not null default now()
      );
    `,
  },
  {
    id: 3,
    name: "add configurable analytics dashboards and widgets",
    sql: `
      create table if not exists analytics_dashboard (
        id uuid primary key default gen_random_uuid(),
        key text not null unique,
        name text not null,
        description text,
        status text not null default 'draft' check (status in ('draft','published','archived')),
        layout jsonb not null default '{}'::jsonb,
        filters jsonb not null default '[]'::jsonb,
        created_by uuid,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      );

      create table if not exists analytics_widget (
        id uuid primary key default gen_random_uuid(),
        dashboard_id uuid not null references analytics_dashboard(id) on delete cascade,
        key text not null,
        title text not null,
        visualization text not null check (visualization in ('metric','table','bar','line','pie','funnel','area')),
        source_resource text not null references resource(key) on delete restrict,
        snapshot_id uuid references business_snapshot(id) on delete set null,
        query jsonb not null default '{}'::jsonb,
        layout jsonb not null default '{}'::jsonb,
        position integer not null default 0,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now(),
        unique (dashboard_id, key)
      );
      create index if not exists analytics_widget_dashboard on analytics_widget(dashboard_id, position);

      insert into resource (key, name, description, sidebar_visible, sidebar_order, route_path)
      values ('analytics', 'Analytics', 'Configurable dashboards and visualizations', true, 10, '/dashboard/analytics')
      on conflict (key) do update set name = excluded.name, route_path = excluded.route_path;
    `,
  },
  {
    id: 4,
    name: "add typed json references and calculated field dependencies",
    sql: `
      create table if not exists business_field (
        id uuid primary key default gen_random_uuid(),
        table_id uuid not null references business_table(id) on delete cascade,
        key text not null,
        label text not null,
        data_type text not null check (data_type in ('text','number','boolean','date','datetime','uuid','json')),
        input_type text not null default 'text',
        required boolean not null default false,
        searchable boolean not null default false,
        sensitive boolean not null default false,
        definition jsonb not null default '{}'::jsonb,
        position integer not null default 0,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now(),
        unique (table_id, key)
      );

      create table if not exists business_field_reference (
        id uuid primary key default gen_random_uuid(),
        field_id uuid not null references business_field(id) on delete cascade,
        path text not null default '$',
        target_resource text not null references resource(key) on delete restrict,
        target_field text not null default 'id',
        display_field text,
        allow_many boolean not null default false,
        created_at timestamptz not null default now()
      );

      create table if not exists business_field_calculation (
        id uuid primary key default gen_random_uuid(),
        field_id uuid not null references business_field(id) on delete cascade,
        path text not null default '$',
        operation text not null check (operation in ('count','sum','avg','min','max','first','concat','lookup')),
        source_resource text not null references resource(key) on delete restrict,
        source_field text,
        match_local_field text,
        match_source_field text,
        expression jsonb not null default '{}'::jsonb,
        refresh_mode text not null default 'on_read' check (refresh_mode in ('on_read','on_write','scheduled','materialized')),
        created_at timestamptz not null default now()
      );
      create index if not exists business_field_calc_source on business_field_calculation(source_resource);
    `,
  },
  {
    id: 5,
    name: "extend calculated fields with cross-table arithmetic",
    sql: `
      alter table business_field_calculation drop constraint if exists business_field_calculation_operation_check;
      alter table business_field_calculation add constraint business_field_calculation_operation_check
        check (operation in ('count','sum','avg','min','max','first','concat','lookup','add','subtract','multiply','divide'));
    `,
  },
  {
    id: 6,
    name: "make calculation operations extensible",
    sql: `
      alter table business_field_calculation drop constraint if exists business_field_calculation_operation_check;
    `,
  },
  {
    id: 7,
    name: "add transactional business validation rules",
    sql: `
      create table if not exists business_rule (
        id uuid primary key default gen_random_uuid(),
        business_id uuid not null references business_definition(id) on delete cascade,
        name text not null,
        event_resource text not null references resource(key) on delete restrict,
        event_action text not null check (event_action in ('create','update','delete')),
        kind text not null check (kind in ('validation','stock_guard','workflow')),
        definition jsonb not null default '{}'::jsonb,
        error_message text not null,
        enabled boolean not null default true,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      );
      create index if not exists business_rule_event on business_rule(event_resource, event_action) where enabled = true;
    `,
  },
  {
    id: 8,
    name: "require explicit policies for generated business resources",
    sql: `
      alter table resource add column if not exists requires_explicit_policy boolean not null default false;
      update resource set requires_explicit_policy = true where route_path like '/dashboard/data/%';
    `,
  },
];
