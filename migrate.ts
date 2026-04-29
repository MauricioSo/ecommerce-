import pg from "pg";

const connStr = process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/ecommerce";
const client = new pg.Client({ connectionString: connStr });

await client.connect();

const migrations = await Bun.file("./drizzle/0000_cheerful_skaar.sql").text();
const statements = migrations.split("--> statement-breakpoint").map(s => s.trim()).filter(Boolean);

for (const statement of statements) {
  if (statement) {
    console.log("Executing:", statement.substring(0, 60) + "...");
    try {
      await client.query(statement);
    } catch (e: any) {
      if (e.code !== "42P07") { // Table already exists
        console.error("Error:", e.message);
      }
    }
  }
}

await client.end();
console.log("✓ Migrations completed");
