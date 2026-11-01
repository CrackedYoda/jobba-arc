import "server-only";

import { Pool, types } from "pg";

import { getServerEnv } from "@/lib/config/env";

// Keep timestamptz as full-precision text so keyset cursors round-trip exactly.
types.setTypeParser(1184, (value) => value);

export type Database = Pool;

declare global { var __jobbaPool: Pool | undefined; }

export function hasDatabase(): boolean {
  return Boolean(getServerEnv().DATABASE_URL);
}

export function getDatabase(): Database {
  if (globalThis.__jobbaPool) return globalThis.__jobbaPool;
  const { DATABASE_URL } = getServerEnv();
  if (!DATABASE_URL) throw new Error("DATABASE_URL is not configured.");
  const pool = new Pool({ connectionString: DATABASE_URL, max: 10 });
  globalThis.__jobbaPool = pool;
  return pool;
}
