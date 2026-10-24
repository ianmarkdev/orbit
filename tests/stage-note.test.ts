import { describe, expect, it } from 'vitest';

import { parseStageNote } from '@/lib/applications/stage-note';

describe('parseStageNote', () => {
    it('treats a missing or blank note as none', () => {
        expect(parseStageNote(null)).toEqual({ ok: true, note: null });
        expect(parseStageNote('  ​ \n ')).toEqual({ ok: true, note: null });
    });

    it('normalises the note as plain text and keeps its line breaks', () => {
        expect(parseStageNote('  Applied via LinkedIn\r\n\r\n\r\nRef   4471  ')).toEqual({ ok: true, note: 'Applied via LinkedIn\n\nRef 4471' });
    });

    it('rejects a note over 500 characters, counted as Laravel does', () => {
        expect(parseStageNote('é'.repeat(500))).toEqual({ ok: true, note: 'é'.repeat(500) });
        expect(parseStageNote('x'.repeat(501)).ok).toBe(false);
    });
});
