export const ACTIONS = [
  { key: "view", name: "View one" },
  { key: "viewAny", name: "View list" },
  { key: "create", name: "Create" },
  { key: "update", name: "Update" },
  { key: "delete", name: "Delete" },
  { key: "assign", name: "Assign" },
  { key: "import", name: "Import" },
  { key: "export", name: "Export" },
  { key: "restore", name: "Restore" },
] as const;

export type ActionKey = (typeof ACTIONS)[number]["key"];

/** The only actions that are NOT written to the audit log. */
export const UNLOGGED_ACTIONS: ReadonlySet<string> = new Set(["view", "viewAny"]);
export const isLogged = (action: string) => !UNLOGGED_ACTIONS.has(action);

export const SYSTEM_RESOURCES = [
  { key: "team", name: "Teams" },
  { key: "user", name: "Users" },
  { key: "role", name: "Roles" },
  { key: "setting", name: "Settings" },
  { key: "audit", name: "Audit log" },
  { key: "resource", name: "Resources" },
  { key: "action", name: "Actions" },
  { key: "pbac", name: "Access policies" },
  { key: "backup", name: "Backups" },
  { key: "business", name: "Business designer" },
  { key: "business_definition", name: "Business definitions" },
] as const;

export const TRANSFER_ENTITIES = ["team", "user", "resource", "pbac", "audit"] as const;
export const IMPORTABLE_ENTITIES = ["team", "user", "resource"] as const;
export type TransferEntity = (typeof TRANSFER_ENTITIES)[number];
