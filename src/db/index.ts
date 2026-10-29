import 'server-only';

import { attachDatabasePool } from '@vercel/functions';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

import * as schema from './schema';

/**
 * One pool per function instance. Vercel's Fluid compute reuses an instance across requests, so a
 * plain `pg` pool works and supports interactive transactions (the capture needs one for its
 * advisory lock). `attachDatabasePool` keeps a suspending instance alive until idle connections
 * are closed, so they aren't left open on Neon; it does nothing outside Vercel. In production
 * DATABASE_URL is Neon's pooled (`-pooler`) connection string for the `career_va` role; locally
 * it can be any Postgres holding Career Engine's schema.
 */
const globalForDb = globalThis as unknown as { careerVaPool?: Pool };

const pool = globalForDb.careerVaPool ?? createPool();

function createPool(): Pool {
    const created = new Pool({
        connectionString: process.env.DATABASE_URL,
        max: Number(process.env.DATABASE_POOL_MAX ?? 5),
        // Short, because the instance is kept alive this long after its last query.
        idleTimeoutMillis: 5_000,
    });

    attachDatabasePool(created);

    return created;
}

if (process.env.NODE_ENV !== 'production') {
    globalForDb.careerVaPool = pool;
}

export const db = drizzle(pool, { schema });

export type Db = typeof db;
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];
