import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { currentActor } from '@/lib/auth/session';

import { SignInButton } from './sign-in-button';

export const metadata: Metadata = { title: 'Sign in · Career VA' };

export default async function LoginPage() {
    if (await currentActor()) {
        redirect('/applications');
    }

    return (
        <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-4 py-16">
            <div className="space-y-2">
                <h1 className="text-2xl font-semibold">Career VA</h1>
                <p className="text-sm text-muted">
                    Sign in with the Google account that uses the same email address as your Career Engine account.
                </p>
            </div>
            <SignInButton />
        </main>
    );
}
