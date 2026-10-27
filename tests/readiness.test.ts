import { describe, expect, it } from 'vitest';

import { isReady, missingSummary, readinessChecks, type ReadinessCounts } from '@/lib/applications/readiness';

const approved: ReadinessCounts = {
    reviewStatus: 'approved',
    resumeApproved: true,
    coverLetterTotal: 1,
    coverLetterApproved: 1,
    questionsTotal: 3,
    questionsApproved: 3,
};

describe('readiness', () => {
    it('is ready when everything is approved', () => {
        const checks = readinessChecks(approved);

        expect(isReady(checks)).toBe(true);
        expect(missingSummary(checks, approved)).toBe('');
    });

    it('does not need a cover letter or questions the form does not ask for', () => {
        const counts = { ...approved, coverLetterTotal: 0, coverLetterApproved: 0, questionsTotal: 0, questionsApproved: 0 };
        const checks = readinessChecks(counts);

        expect(checks.find((check) => check.key === 'cover_letter')?.state).toBe('not_needed');
        expect(checks.find((check) => check.key === 'questions')?.detail).toBe('No form questions');
        expect(isReady(checks)).toBe(true);
    });

    it('is not ready while the cover letter is unapproved', () => {
        const counts = { ...approved, coverLetterApproved: 0 };

        expect(isReady(readinessChecks(counts))).toBe(false);
        expect(missingSummary(readinessChecks(counts), counts)).toBe('cover letter');
    });

    it('is not ready while changes are requested', () => {
        const counts: ReadinessCounts = { ...approved, reviewStatus: 'changes_requested' };
        const review = readinessChecks(counts).find((check) => check.key === 'review');

        expect(review).toMatchObject({ state: 'missing', detail: 'Changes requested' });
        expect(isReady(readinessChecks(counts))).toBe(false);
    });

    it('lists what is missing in one line', () => {
        const counts = { ...approved, resumeApproved: false, questionsApproved: 2 };

        expect(missingSummary(readinessChecks(counts), counts)).toBe('resume, 1 answer');
        expect(missingSummary(readinessChecks({ ...counts, questionsApproved: 0 }), { ...counts, questionsApproved: 0 })).toBe('resume, 3 answers');
    });
});
