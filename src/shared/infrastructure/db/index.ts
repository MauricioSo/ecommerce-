import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { getConfig } from "../config.ts";

const { Pool } = pg;

let pool: pg.Pool | null = null;
let dbInstance: ReturnType<typeof drizzle> | null = null;

export function getPool(): pg.Pool {
  if (pool) return pool;
  const config = getConfig();
  const sslConfig = (config.NODE_ENV === "production" || config.DB_SSL === "true")
    ? { ssl: { rejectUnauthorized: true } }
    : {};
  pool = new Pool({
    connectionString: config.DATABASE_URL,
    min: config.DB_POOL_MIN,
    max: config.DB_POOL_MAX,
    ...sslConfig,
  });
  return pool;
}

export function getDb() {
  if (dbInstance) return dbInstance;
  dbInstance = drizzle(getPool());
  return dbInstance;
}

export async function closeDb(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    dbInstance = null;
  }
}

export async function healthCheck(): Promise<boolean> {
  const client = await getPool().connect();
  try {
    await client.query("SELECT 1");
    return true;
  } finally {
    client.release();
  }
}
