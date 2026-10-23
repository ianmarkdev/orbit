'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { resolveActor } from '@/lib/auth/actor';
import { checkPassword, startSession } from '@/lib/auth/session';
import { hit } from '@/lib/rate-limit';

export type SignInState = { error: string | null; email: string };

const INVALID = 'These credentials do not match our records.';

export async function signIn(_: SignInState, form: FormData): Promise<SignInState> {
    const email = String(form.get('email') ?? '').trim();
    const password = String(form.get('password') ?? '');

    if (email === '' || password === '') {
        return { error: 'Enter your email address and password.', email };
    }

    // Fortify's login limit: 5 a minute per email and IP address.
    const ip = (await headers()).get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'local';
    const limit = hit(`login:${email.toLowerCase()}|${ip}`, 5);

    if (!limit.allowed) {
        return { error: `Too many sign-in attempts. Try again in ${limit.retryAfter} seconds.`, email };
    }

    const userId = await checkPassword(email, password);

    if (userId === null) {
        return { error: INVALID, email };
    }

    const actor = await resolveActor({ userId });

    if (!actor.ok) {
        return { error: actor.message, email };
    }

    // Career VA cannot ask for a 2FA code, so an account protected by one signs in to Career Engine only.
    if (actor.actor.usesTwoFactor) {
        return { error: 'This account uses two-factor authentication, which Career VA does not support. Use Career Engine instead.', email };
    }

    await startSession(userId);
    redirect('/applications');
}
