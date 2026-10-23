import { cookies } from 'next/headers';

import { resolveActor } from '@/lib/auth/actor';
import { adminAuth } from '@/lib/auth/firebase-admin';
import { SESSION_COOKIE, SESSION_DAYS } from '@/lib/auth/session';

/**
 * Exchange a fresh Firebase ID token (from the Google sign-in on /login) for a session cookie.
 * Only Career Engine users who may act get one, so an unknown Google account never holds a
 * session. Sign-out is the server action in the app layout.
 */
export async function POST(request: Request): Promise<Response> {
    const body: unknown = await request.json().catch(() => null);
    const idToken = typeof body === 'object' && body !== null && 'idToken' in body ? body.idToken : null;

    if (typeof idToken !== 'string') {
        return Response.json({ message: 'Sign in again.' }, { status: 400 });
    }

    let email: string;

    try {
        const claims = await adminAuth().verifyIdToken(idToken, true);

        // createSessionCookie() expects a recent sign-in, not a token refreshed from an old one.
        if (Date.now() / 1000 - claims.auth_time > 5 * 60 || !claims.email || claims.email_verified !== true) {
            return Response.json({ message: 'Sign in again.' }, { status: 401 });
        }

        email = claims.email;
    } catch {
        return Response.json({ message: 'Sign in again.' }, { status: 401 });
    }

    const actor = await resolveActor({ email });

    if (!actor.ok) {
        return Response.json({ message: actor.message }, { status: 403 });
    }

    const expiresIn = SESSION_DAYS * 24 * 60 * 60 * 1000;
    const sessionCookie = await adminAuth().createSessionCookie(idToken, { expiresIn });

    (await cookies()).set(SESSION_COOKIE, sessionCookie, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: expiresIn / 1000,
    });

    return Response.json({ ok: true });
}
