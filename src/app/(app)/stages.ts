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

/**
 * "28 Oct 2026, 14:05 UTC", for a tooltip that gives the exact moment behind a date. Pages render
 * on the server, which runs in UTC on Vercel, so the zone is stated rather than implied.
 */
export function formatDateTime(value: Date): string {
    return `${value.toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })} UTC`;
}
