import 'server-only';

/**
 * A fixed one-minute window per key, in this instance's memory. Career Engine's
 * `throttle:application-capture` is 30 a minute per user; with more than one App Hosting instance
 * the effective limit is 30 per instance, which is enough to stop a runaway client.
 */
const windows = new Map<string, { startedAt: number; count: number }>();

export function hit(key: string, limit: number): { allowed: true } | { allowed: false; retryAfter: number } {
    const now = Date.now();
    const window = windows.get(key);

    if (window === undefined || now - window.startedAt >= 60_000) {
        windows.set(key, { startedAt: now, count: 1 });

        if (windows.size > 10_000) {
            for (const [staleKey, stale] of windows) {
                if (now - stale.startedAt >= 60_000) windows.delete(staleKey);
            }
        }

        return { allowed: true };
    }

    if (window.count >= limit) {
        return { allowed: false, retryAfter: Math.ceil((window.startedAt + 60_000 - now) / 1000) };
    }

    window.count++;

    return { allowed: true };
}
