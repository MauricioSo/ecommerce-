import { migrate } from "drizzle-orm/node-postgres/migrator";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { getConfig } from "./src/shared/infrastructure/config.ts";

const config = getConfig();
const pool = new pg.Pool({
  connectionString: config.DATABASE_URL,
});

const db = drizzle(pool);

async function run() {
  console.log("Running migrations...");
  try {
    await migrate(db, { migrationsFolder: "./drizzle" });
    console.log("Migrations completed successfully");
  } catch (error) {
    console.error("Migration error:", error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

run();
