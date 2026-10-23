'use client';

import { GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { clientAuth } from '@/lib/auth/firebase-client';

export function SignInButton() {
    const router = useRouter();
    const [error, setError] = useState<string | null>(null);
    const [pending, setPending] = useState(false);

    async function signIn() {
        setError(null);
        setPending(true);

        const auth = clientAuth();

        try {
            const { user } = await signInWithPopup(auth, new GoogleAuthProvider());
            const response = await fetch('/api/session', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ idToken: await user.getIdToken() }),
            });

            if (!response.ok) {
                const body = await response.json().catch(() => null);
                setError(body?.message ?? 'Sign-in failed. Try again.');
                return;
            }

            router.replace('/applications');
            router.refresh();
        } catch (caught) {
            if (!(caught instanceof Error && 'code' in caught && caught.code === 'auth/popup-closed-by-user')) {
                setError('Sign-in failed. Try again.');
            }
        } finally {
            // The server session cookie is the only credential; nothing stays signed in in the browser.
            await signOut(auth).catch(() => {});
            setPending(false);
        }
    }

    return (
        <div className="space-y-3">
            <button
                type="button"
                onClick={signIn}
                disabled={pending}
                className="w-full rounded-md bg-foreground px-4 py-2.5 text-sm font-medium text-background disabled:opacity-60"
            >
                {pending ? 'Signing in…' : 'Sign in with Google'}
            </button>
            {error && (
                <p role="alert" className="text-sm text-danger">
                    {error}
                </p>
            )}
        </div>
    );
}
