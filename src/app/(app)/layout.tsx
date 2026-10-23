import Link from 'next/link';

import { requireActor } from '@/lib/auth/session';

import { signOut } from './actions';

/** Every page in this group needs a signed-in Career Engine user. */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
    const actor = await requireActor();

    return (
        <>
            <header className="border-b border-border">
                <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
                    <Link href="/applications" className="font-semibold">
                        Career VA
                    </Link>
                    <div className="flex items-center gap-4 text-sm">
                        <span className="hidden text-muted sm:inline">{actor.name}</span>
                        <form action={signOut}>
                            <button type="submit" className="text-muted hover:text-foreground">
                                Sign out
                            </button>
                        </form>
                    </div>
                </div>
            </header>
            <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">{children}</main>
        </>
    );
}
