import { Pool, type QueryResult, type QueryResultRow } from "pg";

const globalForDb = globalThis as unknown as { familyDb?: Pool };

function createPool() {
  return new Pool({
    host: process.env.DATABASE_HOST ?? "database",
    port: Number(process.env.POSTGRES_PORT ?? 5432),
    database: process.env.POSTGRES_DB ?? "julianne_family",
    user: process.env.POSTGRES_USER ?? "julianne_app",
    password: process.env.POSTGRES_PASSWORD,
    max: 5,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000
  });
}

export const db = globalForDb.familyDb ?? createPool();

if (process.env.NODE_ENV !== "production") {
  globalForDb.familyDb = db;
}

export function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = []
): Promise<QueryResult<T>> {
  return db.query<T>(text, params);
}

export async function hasUsers() {
  const result = await query<{ exists: boolean }>(
    "SELECT EXISTS (SELECT 1 FROM users WHERE active = true) AS exists"
  );
  return result.rows[0]?.exists ?? false;
}
