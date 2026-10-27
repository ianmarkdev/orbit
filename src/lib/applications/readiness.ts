import type { ReviewStatus, Stage } from '@/db/schema';

/**
 * Whether an application has everything a VA needs to send it: an approved review, the approved
 * tailored resume, and an approved answer for every form question (the cover letter is one).
 * Shared by the list and the detail page so both always agree.
 */

/** Stages still waiting to be sent: readiness means nothing once an application is out. */
export const OPEN_STAGES: readonly Stage[] = ['saved', 'preparing'];

/** ReviewStatus::label(). */
export const REVIEW_LABELS: Record<ReviewStatus, string> = {
    not_started: 'Not started',
    in_progress: 'In progress',
    in_review: 'In review',
    changes_requested: 'Changes requested',
    approved: 'Approved',
};

export type ReadinessCounts = {
    reviewStatus: ReviewStatus;
    resumeApproved: boolean;
    coverLetterTotal: number;
    coverLetterApproved: number;
    /** Form questions other than the cover letter. */
    questionsTotal: number;
    questionsApproved: number;
};

export type CheckKey = 'review' | 'resume' | 'cover_letter' | 'questions';

export type Check = { key: CheckKey; label: string; state: 'done' | 'missing' | 'not_needed'; detail: string };

export function readinessChecks(counts: ReadinessCounts): Check[] {
    return [
        {
            key: 'review',
            label: 'Review',
            state: counts.reviewStatus === 'approved' ? 'done' : 'missing',
            detail: REVIEW_LABELS[counts.reviewStatus] ?? counts.reviewStatus,
        },
        {
            key: 'resume',
            label: 'Resume',
            state: counts.resumeApproved ? 'done' : 'missing',
            detail: counts.resumeApproved ? 'Approved' : 'Not approved yet',
        },
        {
            key: 'cover_letter',
            label: 'Cover letter',
            state: counts.coverLetterTotal === 0 ? 'not_needed' : counts.coverLetterApproved >= counts.coverLetterTotal ? 'done' : 'missing',
            detail: counts.coverLetterTotal === 0 ? 'Not asked for' : counts.coverLetterApproved >= counts.coverLetterTotal ? 'Approved' : 'Not approved yet',
        },
        {
            key: 'questions',
            label: 'Questions',
            state: counts.questionsTotal === 0 ? 'not_needed' : counts.questionsApproved >= counts.questionsTotal ? 'done' : 'missing',
            detail: counts.questionsTotal === 0 ? 'No form questions' : `${counts.questionsApproved} of ${counts.questionsTotal} approved`,
        },
    ];
}

export function isReady(checks: Check[]): boolean {
    return checks.every((check) => check.state !== 'missing');
}

/** "resume, cover letter, 2 answers": what still has to be approved, for a one-line status. */
export function missingSummary(checks: Check[], counts: ReadinessCounts): string {
    return checks
        .filter((check) => check.state === 'missing')
        .map((check) => {
            if (check.key === 'questions') {
                const left = counts.questionsTotal - counts.questionsApproved;

                return `${left} ${left === 1 ? 'answer' : 'answers'}`;
            }

            return check.label.toLowerCase();
        })
        .join(', ');
}
