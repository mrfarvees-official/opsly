import "server-only";
import { buildTenantDatabaseName } from "../domain/tenant-database-name";
import { TenantOwnerProvisioningRepository } from "../infrastructure/tenant-owner-provisioning-repository";
import { hashPassword } from "@/features/auth/infrastructure/password-hasher";
import { PostgresTenantDatabaseCreator } from "@/features/database/infrastructure/postgres/postgres-database-creator";
import { getPrimaryConnectionDetails } from "@/features/database/infrastructure/postgres/primary-connection-details";
import { tenantDatabaseManager } from "@/features/database/server/tenant-database-manager";
import { initializeTenantSchema } from "@/features/platform/infrastructure/tenant-sql";

export interface CreateTenantOwnerInput {
  tenantName: string;
  tenantSlug: string;
  ownerEmail: string;
  ownerPassword: string;
}

export class TenantOwnerProvisioningService {
  constructor(
    private readonly repository = new TenantOwnerProvisioningRepository(),
    private readonly databaseCreator = new PostgresTenantDatabaseCreator(),
    private readonly schemaInitializer = initializeTenantSchema,
  ) {}

  async createTenantOwner(input: CreateTenantOwnerInput) {
    const tenantName = input.tenantName.trim();
    const tenantSlug = input.tenantSlug.trim().toLowerCase();
    const ownerEmail = input.ownerEmail.trim().toLowerCase();

    if (!tenantName) {
      throw new Error("Tenant name is required.");
    }

    if (!ownerEmail) {
      throw new Error("Owner email is required.");
    }

    if (!ownerEmail.includes("@")) {
      throw new Error("Owner email is invalid.");
    }

    const databaseName = buildTenantDatabaseName(tenantSlug);
    const passwordHash = await hashPassword(input.ownerPassword);
    const connectionDetails = getPrimaryConnectionDetails();
    const records = await this.repository.createProvisioningRecords({
      tenantName,
      tenantSlug,
      ownerEmail,
      passwordHash,
      databaseName,
      host: connectionDetails.host,
      port: connectionDetails.port,
      username: connectionDetails.username,
      password: connectionDetails.password,
      ssl: connectionDetails.ssl,
    });

    try {
      await this.databaseCreator.createDatabase(databaseName);

      /*
       * Register the pool while the control-plane
       * record is still "provisioning".
       *
       * This intentionally does not use get(),
       * because get() only resolves ACTIVE
       * tenant databases.
       */
      const tenantDb = await tenantDatabaseManager.register({
        id: records.database.id,
        tenantId: records.tenant.id,
        role: "primary",
        status: "provisioning",
        host: connectionDetails.host,
        port: connectionDetails.port,
        database: databaseName,
        username: connectionDetails.username,
        password: connectionDetails.password,
        ssl: connectionDetails.ssl,
      });

      /*
       * Create the business tables, permission catalog and PBAC policies
       * before the tenant can be used. If this fails, the catch below marks
       * the database as failed.
       */
      await this.schemaInitializer(tenantDb.client);

      await this.repository.markDatabaseActive(records.database.id);

      return {
        tenantId: records.tenant.id,
        ownerId: records.owner.id,
        tenantDatabaseId: records.database.id,
        databaseName,
      };
    } catch (error) {
      await this.repository.markDatabaseFailed(records.database.id);
      throw error;
    }
  }
}
