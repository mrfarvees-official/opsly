import type { DatabaseConnectionConfig } from "../domain/database-connection";

export interface DatabaseProvider<TDatabase> {
  connect(config: DatabaseConnectionConfig): Promise<TDatabase>;

  disconnect(database: TDatabase): Promise<void>;
}
