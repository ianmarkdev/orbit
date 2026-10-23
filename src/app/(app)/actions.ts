'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { STAGES, type Stage } from '@/db/schema';
import { changeStage } from '@/lib/applications/service';
import { SESSION_COOKIE, requireActor } from '@/lib/auth/session';

export type StageFormState = { error: string | null };

/** The application comes from the URL, the stage from the form; the workspace from the session. */
export async function updateStage(applicationUlid: string, _: StageFormState, form: FormData): Promise<StageFormState> {
    const actor = await requireActor();
    const stage = form.get('stage');

    if (typeof stage !== 'string' || !STAGES.includes(stage as Stage)) {
        return { error: 'Choose a stage.' };
    }

    if ((await changeStage(actor, applicationUlid, stage as Stage)) === 'not_found') {
        return { error: 'This application no longer exists.' };
    }

    revalidatePath('/applications', 'layout');

    return { error: null };
}

export async function signOut(): Promise<void> {
    (await cookies()).delete(SESSION_COOKIE);
    redirect('/login');
}
