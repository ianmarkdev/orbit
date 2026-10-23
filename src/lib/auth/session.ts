import 'server-only';

import { createHmac, timingSafeEqual } from 'node:crypto';

import { sql } from 'drizzle-orm';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { cache } from 'react';

import { db } from '@/db';

import { type Actor, resolveActor } from './actor';

/** `__session` is the one cookie Firebase's CDN always forwards to the server. */
export const SESSION_COOKIE = '__session';

const SESSION_HOURS = 12;

/**
 * The VA signs in with their Career Engine email and password. The password is checked inside
 * Postgres (career_va_check_password), so this app never sees a hash. The session is a signed
 * cookie naming the user; resolveActor() re-checks the account on every request, so a
 * deactivated VA loses access at once.
 */
export async function checkPassword(email: string, password: string): Promise<number | null> {
    const result = await db.execute<{ id: string | null }>(sql`SELECT career_va_check_password(${email}, ${password}) AS id`);
    const id = result.rows[0]?.id;

    return id === null || id === undefined ? null : Number(id);
}

export async function startSession(userId: number): Promise<void> {
    const payload = Buffer.from(JSON.stringify({ sub: userId, exp: Date.now() + SESSION_HOURS * 3_600_000 })).toString('base64url');

    (await cookies()).set(SESSION_COOKIE, `${payload}.${sign(payload)}`, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: SESSION_HOURS * 3600,
    });
}

export async function endSession(): Promise<void> {
    (await cookies()).delete(SESSION_COOKIE);
}

export const currentActor = cache(async (): Promise<Actor | null> => {
    const userId = readSession((await cookies()).get(SESSION_COOKIE)?.value);

    if (userId === null) {
        return null;
    }

    const result = await resolveActor({ userId });

    return result.ok ? result.actor : null;
});

/** For pages and server actions: the actor, or a redirect to the sign-in page. */
export async function requireActor(): Promise<Actor> {
    return (await currentActor()) ?? redirect('/login');
}

function readSession(cookie: string | undefined): number | null {
    const [payload, signature] = cookie?.split('.') ?? [];

    if (!payload || !signature) {
        return null;
    }

    const expected = Buffer.from(sign(payload));
    const given = Buffer.from(signature);

    if (expected.length !== given.length || !timingSafeEqual(expected, given)) {
        return null;
    }

    try {
        const { sub, exp } = JSON.parse(Buffer.from(payload, 'base64url').toString()) as { sub: unknown; exp: unknown };

        return typeof sub === 'number' && typeof exp === 'number' && exp > Date.now() ? sub : null;
    } catch {
        return null;
    }
}

function sign(payload: string): string {
    const secret = process.env.SESSION_SECRET;

    if (!secret || secret.length < 32) {
        throw new Error('SESSION_SECRET must be set to at least 32 random characters.');
    }

    return createHmac('sha256', secret).update(payload).digest('base64url');
}
