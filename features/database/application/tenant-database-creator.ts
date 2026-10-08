export interface TanantDatabaseCreator {
  createDatabase(databaseName: string): Promise<void>;
}
