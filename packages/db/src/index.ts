import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema/index";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL environment variable is required");
}

const client = postgres(connectionString, {
  // Pool sizing: enough headroom for concurrent requests without exhausting DB connections.
  // Railway Postgres default allows ~100 connections; we use 50 to leave room for migrations/admin.
  max: 50,

  // Release idle connections after 30s to avoid holding open DB resources unnecessarily.
  idle_timeout: 30,

  // Abort any connection attempt that takes longer than 10s (e.g. DB restart, network blip).
  connect_timeout: 10,

  // Kill queries that run longer than 20s. Prevents runaway queries from blocking the pool.
  // Drizzle passes these as session-level PG settings on each connection.
  connection: {
    statement_timeout: 20_000,    // 20 seconds
    lock_timeout: 10_000,         // 10 seconds — avoid deadlock hangs
  },
});

export const db = drizzle(client, { schema });

export type Database = typeof db;
export * from "./schema/index";
