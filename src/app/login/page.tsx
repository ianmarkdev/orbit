import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { currentActor } from '@/lib/auth/session';

import { SignInForm } from './sign-in-form';

export const metadata: Metadata = { title: 'Sign in · Orbit' };

export default async function LoginPage() {
    if (await currentActor()) {
        redirect('/applications');
    }

    return (
        <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-4 py-16">
            <div className="space-y-2">
                <h1 className="text-2xl font-semibold">Orbit</h1>
                <p className="text-sm text-muted">Sign in with your Career Engine email and password.</p>
            </div>
            <SignInForm />
        </main>
    );
}
