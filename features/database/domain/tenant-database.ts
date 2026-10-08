export type TenantDatabaseStatus = "active" | "provisioning" | "failed" | "disabled";

export type TenantDatabaseRole = "primary" | "replica";

export interface TenantDatabase {
  id: string;
  tenantId: string;
  role: TenantDatabaseRole;
  status: TenantDatabaseStatus;
  host: string;
  port: number;
  database: string;
  username: string;

  /**
   * Password should normally come from
   * an encrypted credential/secrets layer.
   */
  password: string;
  ssl: boolean;
}
