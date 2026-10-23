import 'server-only';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { cache } from 'react';

import { type Actor, resolveActor } from './actor';
import { adminAuth } from './firebase-admin';

/** `__session` is the one cookie Firebase's CDN always forwards to the server. */
export const SESSION_COOKIE = '__session';

export const SESSION_DAYS = 5;

/**
 * The VA signs in with Google through Firebase Auth; the server turns that sign-in into a
 * Firebase session cookie. Firebase only proves the email address: Career Engine's users table
 * still decides who may use the app (resolveActor), checked again on every request so a
 * deactivated account loses access at once.
 */
export const currentActor = cache(async (): Promise<Actor | null> => {
    const cookie = (await cookies()).get(SESSION_COOKIE)?.value;

    if (!cookie) {
        return null;
    }

    try {
        const claims = await adminAuth().verifySessionCookie(cookie, true);

        if (!claims.email || claims.email_verified !== true) {
            return null;
        }

        const result = await resolveActor({ email: claims.email });

        return result.ok ? result.actor : null;
    } catch {
        return null;
    }
});

/** For pages and server actions: the actor, or a redirect to the sign-in page. */
export async function requireActor(): Promise<Actor> {
    return (await currentActor()) ?? redirect('/login');
}
