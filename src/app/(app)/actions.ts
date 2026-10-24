'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { STAGES, type Stage } from '@/db/schema';
import { changeStage } from '@/lib/applications/service';
import { parseStageNote } from '@/lib/applications/stage-note';
import { endSession, requireActor } from '@/lib/auth/session';

export type StageFormState = { error: string | null; saved: 'changed' | 'noted' | null };

/** The application comes from the URL, the stage and note from the form; the workspace from the session. */
export async function updateStage(applicationUlid: string, _: StageFormState, form: FormData): Promise<StageFormState> {
    const actor = await requireActor();
    const stage = form.get('stage');
    const note = parseStageNote(form.get('note'));

    if (typeof stage !== 'string' || !STAGES.includes(stage as Stage)) {
        return { error: 'Choose a stage.', saved: null };
    }

    if (!note.ok) {
        return { error: note.error, saved: null };
    }

    const result = await changeStage(actor, applicationUlid, stage as Stage, note.note);

    if (result === 'not_found') {
        return { error: 'This application no longer exists.', saved: null };
    }

    revalidatePath('/applications', 'layout');

    return { error: null, saved: result === 'unchanged' ? null : result };
}

export async function signOut(): Promise<void> {
    await endSession();
    redirect('/login');
}
