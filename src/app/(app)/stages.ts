import type { Stage } from '@/db/schema';

/** ApplicationStage::label(). */
export const STAGE_LABELS: Record<Stage, string> = {
    saved: 'Saved',
    preparing: 'Preparing',
    applied: 'Applied',
    interviewing: 'Interviewing',
    offer: 'Offer',
    rejected: 'Rejected',
    withdrawn: 'Withdrawn',
};

export function formatDate(value: Date | string | null): string {
    if (value === null) {
        return '—';
    }

    // `date` columns arrive as Y-m-d strings: show them as calendar dates, not UTC midnights.
    const date = typeof value === 'string' ? new Date(`${value}T00:00:00`) : value;

    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}
