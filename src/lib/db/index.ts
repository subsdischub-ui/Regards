import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const connectionString = process.env.DATABASE_URL!;

// The default postgres-js pool is max:10, shared by API requests, the per-minute
// cron, startup recovery, and media processing — easily contended under load.
// Postgres defaults to 100 connections, so a larger pool is safe; tune via env.
// Guard the env override: only a positive integer is honoured, so a typo
// ('abc' → NaN), a zero, or a negative ('-5', which postgres-js would reject)
// all fall back to the safe default instead of crashing the pool on boot.
const parsedPoolMax = Number(process.env.DB_POOL_MAX);
const poolMax = Number.isInteger(parsedPoolMax) && parsedPoolMax > 0 ? parsedPoolMax : 20;
const client = postgres(connectionString, { max: poolMax });
export const db = drizzle(client, { schema });