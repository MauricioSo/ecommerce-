import { defineConfig } from "drizzle-kit";
import { getConfig } from "./src/shared/infrastructure/config.ts";

const config = getConfig();

export default defineConfig({
  schema: "./src/shared/infrastructure/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: config.DATABASE_URL,
  },
});
