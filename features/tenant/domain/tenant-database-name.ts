const DATABASE_PREFIX = "opsly_";

export function buildTenantDatabaseName(slug: string): string {
  const normalized = slug.trim().toLowerCase();

  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(normalized)) {
    throw new Error(
      "Tenant slug may contain only lowercase letters, numbers, and hyphens.",
    );
  }

  const databaseSlug = normalized.replaceAll("-", "_");

  const databaseName = `${DATABASE_PREFIX}${databaseSlug}`;

  if (databaseName.length > 63) {
    throw new Error("Tenant database name is too long.");
  }

  return databaseName;
}
