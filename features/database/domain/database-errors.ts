export class DatabaseNotFoundError extends Error {
  constructor(id: string) {
    super(`Database "${id}" is not registered.`);
    this.name = "DatabaseNotFoundError";
  }
}

export class DatabaseAlreadyRegisteredError extends Error {
  constructor(id: string) {
    super(`Database "${id}" is already registered.`);
    this.name = "DatabaseAlreadyRegisteredError";
  }
}

export class TenantDatabaseNotFoundError extends Error {
  constructor(tenantId: string) {
    super(`No active database found for tenant "${tenantId}".`);
    this.name = "TenantDatabaseNotFoundError";
  }
}
