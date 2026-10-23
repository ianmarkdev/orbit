'use client';

import { useActionState } from 'react';

import type { Stage } from '@/db/schema';

import { type StageFormState, updateStage } from '../../actions';

/** `labels` lists every stage in pipeline order (kept server-side so Drizzle stays out of the bundle). */

export function StageForm({ applicationUlid, stage, labels }: { applicationUlid: string; stage: Stage; labels: Record<Stage, string> }) {
    const [state, action, pending] = useActionState<StageFormState, FormData>(updateStage.bind(null, applicationUlid), { error: null });

    return (
        <form action={action} className="flex shrink-0 flex-col gap-1">
            <label htmlFor="stage" className="text-sm text-muted">
                Stage
            </label>
            <div className="flex gap-2">
                <select
                    id="stage"
                    name="stage"
                    defaultValue={stage}
                    className="rounded-md border border-border bg-background px-3 py-2 text-sm"
                >
                    {Object.entries(labels).map(([option, label]) => (
                        <option key={option} value={option}>
                            {label}
                        </option>
                    ))}
                </select>
                <button type="submit" disabled={pending} className="rounded-md bg-foreground px-3 py-2 text-sm font-medium text-background disabled:opacity-60">
                    {pending ? 'Saving…' : 'Update'}
                </button>
            </div>
            {state.error && (
                <p role="alert" className="text-sm text-danger">
                    {state.error}
                </p>
            )}
        </form>
    );
}
