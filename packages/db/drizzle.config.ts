import type { Config } from "drizzle-kit";

export default {
  schema: "./src/schema/*.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgresql://postgres:password@localhost:5432/klip",
    ssl: process.env.DATABASE_URL ? "require" : false,
  },
  verbose: true,
  strict: false,
} satisfies Config;
