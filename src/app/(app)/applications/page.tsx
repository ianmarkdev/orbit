import type { Metadata } from 'next';
import Link from 'next/link';

import { STAGES, type Stage } from '@/db/schema';
import { OPEN_STAGES, isReady, missingSummary, readinessChecks, type Check } from '@/lib/applications/readiness';
import { countReadyToApply, listApplications, type ListFilters, type ReadinessFilter } from '@/lib/applications/service';
import { requireActor } from '@/lib/auth/session';

import { STAGE_LABELS, formatDate } from '../stages';

export const metadata: Metadata = { title: 'Applications · Career VA' };

const READINESS_FILTERS: { value: ReadinessFilter | null; label: string }[] = [
    { value: null, label: 'All' },
    { value: 'ready', label: 'Ready to apply' },
    { value: 'not_ready', label: 'Not ready' },
    { value: 'changes_requested', label: 'Changes requested' },
];

const SORTS = { newest: 'Newest first', deadline: 'Deadline soonest' } as const;

const chip = 'shrink-0 rounded-full border border-border px-3 py-1 text-muted aria-[current=page]:border-foreground aria-[current=page]:text-foreground';

export default async function ApplicationsPage({ searchParams }: PageProps<'/applications'>) {
    const actor = await requireActor();
    const filters = parseFilters(await searchParams);
    const [applications, readyCount] = await Promise.all([listApplications(actor, filters), countReadyToApply(actor)]);
    const filtered = filters.stage !== null || filters.readiness !== null || filters.search !== null || filters.sort !== 'newest';

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h1 className="text-xl font-semibold">Applications</h1>
                <p className="text-sm text-muted">Save new listings with the Career Clipper extension.</p>
            </div>

            <div className="space-y-3">
                <nav aria-label="Filter by readiness" className="-mx-4 flex gap-1 overflow-x-auto px-4 text-sm [scrollbar-width:none]">
                    {READINESS_FILTERS.map((option) => (
                        <Link
                            key={option.value ?? 'all'}
                            href={filterHref(filters, { readiness: option.value })}
                            aria-current={option.value === filters.readiness ? 'page' : undefined}
                            className={chip}
                        >
                            {option.label}
                            {option.value === 'ready' && (
                                <span className="ml-1.5 rounded-full bg-green-600/10 px-1.5 text-green-700 dark:text-green-400">{readyCount}</span>
                            )}
                        </Link>
                    ))}
                </nav>

                <nav aria-label="Filter by stage" className="-mx-4 flex gap-1 overflow-x-auto px-4 text-sm [scrollbar-width:none]">
                    {[null, ...STAGES].map((option) => (
                        <Link key={option ?? 'all'} href={filterHref(filters, { stage: option })} aria-current={option === filters.stage ? 'page' : undefined} className={chip}>
                            {option === null ? 'All stages' : STAGE_LABELS[option]}
                        </Link>
                    ))}
                </nav>

                <form action="/applications" className="flex flex-wrap items-center gap-2 text-sm">
                    {filters.stage && <input type="hidden" name="stage" value={filters.stage} />}
                    {filters.readiness && <input type="hidden" name="ready" value={filters.readiness} />}
                    <input
                        type="search"
                        name="q"
                        defaultValue={filters.search ?? ''}
                        placeholder="Search role or company"
                        aria-label="Search role or company"
                        className="min-w-0 flex-1 rounded-md border border-border bg-background px-3 py-1.5"
                    />
                    <select name="sort" defaultValue={filters.sort} aria-label="Sort" className="rounded-md border border-border bg-background px-2 py-1.5">
                        {Object.entries(SORTS).map(([value, label]) => (
                            <option key={value} value={value}>
                                {label}
                            </option>
                        ))}
                    </select>
                    <button type="submit" className="rounded-md border border-border px-3 py-1.5 hover:bg-surface">
                        Apply
                    </button>
                    {filtered && (
                        <Link href="/applications" className="px-1 text-muted hover:text-foreground">
                            Clear
                        </Link>
                    )}
                </form>
            </div>

            {applications.length === 0 ? (
                <p className="rounded-lg border border-dashed border-border px-4 py-10 text-center text-sm text-muted">
                    {filtered ? 'No applications match these filters.' : 'No applications yet.'}
                </p>
            ) : (
                <ul className="divide-y divide-border rounded-lg border border-border">
                    {applications.map((application) => {
                        const open = OPEN_STAGES.includes(application.stage);
                        const checks = readinessChecks(application);
                        const ready = isReady(checks);

                        return (
                            <li key={application.ulid}>
                                <Link href={`/applications/${application.ulid}`} className="flex flex-col gap-2 px-4 py-3 hover:bg-surface sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                                    <div className="min-w-0 space-y-1.5">
                                        <div>
                                            <p className="truncate font-medium">{application.roleTitle}</p>
                                            <p className="truncate text-sm text-muted">
                                                {[application.companyName ?? 'Company not named', application.location].filter(Boolean).join(' · ')}
                                            </p>
                                        </div>
                                        {open && (
                                            <ul aria-label="Readiness" className="flex flex-wrap gap-1 text-xs">
                                                {checks
                                                    .filter((check) => check.state !== 'not_needed')
                                                    .map((check) => (
                                                        <CheckChip key={check.key} check={check} changesRequested={application.reviewStatus === 'changes_requested'} />
                                                    ))}
                                            </ul>
                                        )}
                                    </div>
                                    <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted sm:flex-col sm:items-end">
                                        {open &&
                                            (ready ? (
                                                <span className="rounded-full bg-green-600/10 px-2 py-0.5 font-medium text-green-700 dark:text-green-400">Ready to apply</span>
                                            ) : (
                                                <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-amber-700 dark:text-amber-400">
                                                    Missing: {missingSummary(checks, application)}
                                                </span>
                                            ))}
                                        <span className="flex items-center gap-3">
                                            {open && application.deadlineOn && <Deadline on={application.deadlineOn} />}
                                            <span>
                                                {application.appliedAt ? `Applied ${formatDate(application.appliedAt)}` : `Saved ${formatDate(application.createdAt)}`}
                                            </span>
                                            <span className="rounded-full bg-surface px-2 py-0.5 text-foreground">{STAGE_LABELS[application.stage]}</span>
                                        </span>
                                    </div>
                                </Link>
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
}

function CheckChip({ check, changesRequested }: { check: Check; changesRequested: boolean }) {
    const text = check.key === 'questions' ? `Questions ${check.detail.replace(' approved', '')}` : check.key === 'review' && check.state === 'missing' ? `Review: ${check.detail}` : check.label;
    const tone =
        check.state === 'done'
            ? 'border-green-600/30 text-green-700 dark:text-green-400'
            : check.key === 'review' && changesRequested
              ? 'border-red-500/40 text-red-700 dark:text-red-400'
              : 'border-border text-muted';

    return (
        <li className={`rounded-full border px-2 py-0.5 ${tone}`}>
            <span aria-hidden="true">{check.state === 'done' ? '✓ ' : '○ '}</span>
            <span className="sr-only">{check.state === 'done' ? 'Done: ' : 'Missing: '}</span>
            {text}
        </li>
    );
}

function Deadline({ on }: { on: string }) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const days = Math.round((new Date(`${on}T00:00:00`).getTime() - today.getTime()) / 86_400_000);
    const tone = days < 0 ? 'text-red-600 dark:text-red-400' : days <= 3 ? 'text-amber-700 dark:text-amber-400' : '';

    return <span className={tone}>{days < 0 ? `Overdue ${formatDate(on)}` : `Due ${formatDate(on)}`}</span>;
}

function parseFilters(params: Record<string, string | string[] | undefined>): ListFilters {
    const { stage, ready, q, sort } = params;
    const search = typeof q === 'string' ? q.trim().slice(0, 100) : '';

    return {
        stage: typeof stage === 'string' && STAGES.includes(stage as Stage) ? (stage as Stage) : null,
        readiness: READINESS_FILTERS.find((option) => option.value !== null && option.value === ready)?.value ?? null,
        search: search === '' ? null : search,
        sort: sort === 'deadline' ? 'deadline' : 'newest',
    };
}

/** A link to the list with some filters changed and the others kept. */
function filterHref(filters: ListFilters, change: Partial<ListFilters>): string {
    const next = { ...filters, ...change };
    const query = new URLSearchParams();

    if (next.readiness) query.set('ready', next.readiness);
    if (next.stage) query.set('stage', next.stage);
    if (next.search) query.set('q', next.search);
    if (next.sort !== 'newest') query.set('sort', next.sort);

    const qs = query.toString();

    return qs === '' ? '/applications' : `/applications?${qs}`;
}
