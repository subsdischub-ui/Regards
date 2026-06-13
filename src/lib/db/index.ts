import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const connectionString = process.env.DATABASE_URL!;

// The default postgres-js pool is max:10, shared by API requests, the per-minute
// cron, startup recovery, and media processing — easily contended under load.
// Postgres defaults to 100 connections, so a larger pool is safe; tune via env.
const client = postgres(connectionString, {
  max: Number(process.env.DB_POOL_MAX) || 20,
});
export const db = drizzle(client, { schema });