'use client';

import { useActionState } from 'react';

import { type SignInState, signIn } from './actions';

const inputClass = 'w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:border-foreground';

export function SignInForm() {
    const [state, action, pending] = useActionState<SignInState, FormData>(signIn, { error: null, email: '' });

    return (
        <form action={action} className="space-y-4">
            <div className="space-y-1">
                <label htmlFor="email" className="text-sm font-medium">
                    Email
                </label>
                <input id="email" name="email" type="email" autoComplete="username" required defaultValue={state.email} className={inputClass} />
            </div>
            <div className="space-y-1">
                <label htmlFor="password" className="text-sm font-medium">
                    Password
                </label>
                <input id="password" name="password" type="password" autoComplete="current-password" required className={inputClass} />
            </div>
            {state.error && (
                <p role="alert" className="text-sm text-danger">
                    {state.error}
                </p>
            )}
            <button
                type="submit"
                disabled={pending}
                className="w-full rounded-md bg-foreground px-4 py-2.5 text-sm font-medium text-background disabled:opacity-60"
            >
                {pending ? 'Signing in…' : 'Sign in'}
            </button>
        </form>
    );
}
