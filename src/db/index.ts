import 'server-only';

import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

import * as schema from './schema';

/**
 * One pool per server instance. App Hosting runs a long-lived Node server on Cloud Run, so a
 * plain `pg` pool works and supports interactive transactions (the capture needs one for its
 * advisory lock). In production DATABASE_URL is Neon's pooled (`-pooler`) connection string for
 * the `career_va` role; locally it can be any Postgres holding Career Engine's schema.
 */
const globalForDb = globalThis as unknown as { careerVaPool?: Pool };

const pool =
    globalForDb.careerVaPool ??
    new Pool({
        connectionString: process.env.DATABASE_URL,
        max: Number(process.env.DATABASE_POOL_MAX ?? 5),
        idleTimeoutMillis: 30_000,
    });

if (process.env.NODE_ENV !== 'production') {
    globalForDb.careerVaPool = pool;
}

export const db = drizzle(pool, { schema });

export type Db = typeof db;
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];
