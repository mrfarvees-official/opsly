import type { DatabaseProvider } from "./database-provider";
import type {
  DatabaseConnectionConfig,
  DatabaseId,
} from "../domain/database-connection";
import { DatabaseNotFoundError } from "../domain/database-errors";

export class DatabaseManager<TDatabase> {
  private readonly databases = new Map<DatabaseId, TDatabase>();
  private readonly pending = new Map<DatabaseId, Promise<TDatabase>>();

  constructor(private readonly provider: DatabaseProvider<TDatabase>) {}

  /**
   * Connects to the database, or returns the existing connection if the id
   * is already registered. Concurrent calls share a single connection attempt.
   */
  async register(config: DatabaseConnectionConfig): Promise<TDatabase> {
    const existing = this.databases.get(config.id);

    if (existing) {
      return existing;
    }

    const inFlight = this.pending.get(config.id);

    if (inFlight) {
      return inFlight;
    }

    const connection = this.provider
      .connect(config)
      .then((database) => {
        this.databases.set(config.id, database);
        return database;
      })
      .finally(() => {
        this.pending.delete(config.id);
      });

    this.pending.set(config.id, connection);

    return connection;
  }

  get(id: DatabaseId): TDatabase {
    const database = this.databases.get(id);

    if (!database) {
      throw new DatabaseNotFoundError(id);
    }

    return database;
  }

  has(id: DatabaseId): boolean {
    return this.databases.has(id);
  }

  async remove(id: DatabaseId): Promise<void> {
    const database = this.databases.get(id);

    if (!database) {
      throw new DatabaseNotFoundError(id);
    }

    this.databases.delete(id);
    await this.provider.disconnect(database);
  }

  async closeAll(): Promise<void> {
    for (const [id, database] of this.databases) {
      this.databases.delete(id);
      await this.provider.disconnect(database);
    }
  }
}
