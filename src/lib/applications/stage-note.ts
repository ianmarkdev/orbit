import { characterCount, normalizePlainText } from '@/lib/plain-text';

export const MAX_STAGE_NOTE_LENGTH = 500;

/**
 * The optional note sent with a stage change, as plain text on one or more lines.
 * Empty means no note.
 */
export function parseStageNote(value: unknown): { ok: true; note: string | null } | { ok: false; error: string } {
    if (value === null || value === undefined) {
        return { ok: true, note: null };
    }

    if (typeof value !== 'string') {
        return { ok: false, error: 'The note must be text.' };
    }

    const note = normalizePlainText(value, true);

    if (characterCount(note) > MAX_STAGE_NOTE_LENGTH) {
        return { ok: false, error: `Keep the note to ${MAX_STAGE_NOTE_LENGTH} characters.` };
    }

    return { ok: true, note: note === '' ? null : note };
}
