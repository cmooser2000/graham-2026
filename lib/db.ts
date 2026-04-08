import { Pool, QueryResult } from "pg";

const pool = new Pool({
  connectionString: process.env.cagov_DATABASE_URL || process.env.DATABASE_URL,
  ssl: process.env.cagov_DATABASE_URL ? { rejectUnauthorized: false } : undefined,
});

export async function query(text: string, params?: unknown[]): Promise<QueryResult> {
  return pool.query(text, params);
}

export { pool };
