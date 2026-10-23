import { describe, expect, it } from 'vitest';

import { normalizePlainText } from '@/lib/plain-text';

// Ported from career-engine/tests/Unit/Domain/Shared/PlainTextTest.php: keep them in step.

describe('normalizePlainText', () => {
    it('removes zero-width characters, bidi overrides and the byte-order mark', () => {
        expect(normalizePlainText('﻿Built​ a Laravel‮ API⁠')).toBe('Built a Laravel API');
    });

    it('removes control characters', () => {
        expect(normalizePlainText('Led\x07 a team\x00 of four')).toBe('Led a team of four');
    });

    it('composes accented characters to NFC so equal text compares equal', () => {
        expect(normalizePlainText('Café rewrite')).toBe('Café rewrite');
    });

    it('collapses runs of spaces, tabs and non-breaking spaces and trims', () => {
        expect(normalizePlainText('  Senior\t   developer  ')).toBe('Senior developer');
    });

    it('joins lines into one line for single-line fields', () => {
        expect(normalizePlainText('Acme\r\n  Ltd')).toBe('Acme Ltd');
    });

    it('keeps line breaks in multi-line fields but allows at most one blank line in a row', () => {
        expect(normalizePlainText('First point  \r\n\r\n\r\n\r\n  Second point\nThird', true)).toBe('First point\n\nSecond point\nThird');
    });
});
