export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  // Production builds run without runtime secrets.
  if (process.env.NEXT_PHASE === "phase-production-build") return;

  const { migrateAllTenants } =
    await import("@/features/platform/application/tenant-migrator");

  // Don't block startup. Requests that arrive first still hit the lazy check.
  void migrateAllTenants().catch((error) =>
    console.error("Tenant schema migration crashed:", error),
  );
}
