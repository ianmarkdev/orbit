/**
 * Port of Career Engine's App\Domain\Shared\PlainText. Text saved here must normalise exactly
 * as it would in Laravel, so both apps apply the same length limits and duplicate checks.
 */

/** Zero-width characters, bidirectional overrides and the byte-order mark. */
const INVISIBLE = /[​-‏‪-‮⁠-⁤﻿]/gu;

/** Control characters other than tab and newline. */
const CONTROL = /[\x00-\x08\x0B-\x1F\x7F]/gu;

/** PHP's trim() character set (without the u-flag \s, PCRE matches ASCII whitespace only). */
const phpTrim = (text: string): string => text.replace(/^[ \t\n\r\0\x0B]+|[ \t\n\r\0\x0B]+$/g, '');

/**
 * Unicode NFC, strip invisible and control characters, collapse runs of spaces, trim.
 * Multi-line text keeps line breaks (at most one blank line in a row); single-line text joins lines.
 */
export function normalizePlainText(text: string, multiline = false): string {
    text = text.normalize('NFC');
    text = text.replace(/\r\n|\r/g, '\n');
    text = text.replace(INVISIBLE, '');
    text = text.replace(CONTROL, '');
    text = text.replace(/[\t  ]+/gu, ' ');

    if (!multiline) {
        return phpTrim(text.replace(/[ \t\n\x0B\f\r]*\n[ \t\n\x0B\f\r]*/g, ' '));
    }

    const lines = text.split('\n').map(phpTrim);

    return phpTrim(lines.join('\n').replace(/\n{3,}/g, '\n\n'));
}

/** Length as Laravel's `max:` rule counts it (mb_strlen: code points, not UTF-16 units). */
export function characterCount(text: string): number {
    return Array.from(text).length;
}
