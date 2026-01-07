import { defineConfig } from "drizzle-kit";

const DIALECT = (process.env.DB_DIALECT ?? "sqlite").toLowerCase();
const isPostgres = DIALECT === "postgresql" || DIALECT === "postgres";
const defaultSqliteUrl = "file:./data/XyraPanel.sqlite";

function resolveDatabaseUrl() {
  if (isPostgres) {
    const url = process.env.DRIZZLE_DATABASE_URL;
    if (!url) {
      throw new Error("DRIZZLE_DATABASE_URL is required when DB_DIALECT=postgresql");
    }
    return url;
  }

  return process.env.DRIZZLE_DATABASE_URL || defaultSqliteUrl;
}

export default defineConfig({
  dialect: isPostgres ? "postgresql" : "sqlite",
  schema: "./server/database/schema.ts",
  out: "./server/database/migrations",
  dbCredentials: {
    url: resolveDatabaseUrl(),
  },
});
