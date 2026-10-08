export interface PostgresConnectionDetails {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl: boolean;
}

export function buildPostgresConnectionUrl(
  database: PostgresConnectionDetails,
): string {
  const encodedUsername = encodeURIComponent(database.username);

  const encodedPassword = encodeURIComponent(database.password);

  const encodedDatabase = encodeURIComponent(database.database);

  const url = `postgresql://${encodedUsername}:${encodedPassword}@${database.host}:${database.port}/${encodedDatabase}`;

  if (!database.ssl) {
    return url;
  }

  return `${url}?sslmode=require`;
}
