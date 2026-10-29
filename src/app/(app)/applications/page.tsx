import type { Metadata } from 'next';
import Link from 'next/link';

import { STAGES, type Stage } from '@/db/schema';
import { OPEN_STAGES, isReady, missingSummary, readinessChecks, type Check } from '@/lib/applications/readiness';
import { LIST_LIMIT, countReadyToApply, listApplications, type ListFilters, type ReadinessFilter } from '@/lib/applications/service';
import { requireActor } from '@/lib/auth/session';

import { STAGE_LABELS, formatDate, formatDateTime } from '../stages';

export const metadata: Metadata = { title: 'Applications · Orbit' };

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
                <div className="space-y-2">
                    <p className="text-sm text-muted">
                        {applications.length === LIST_LIMIT ? `Showing the first ${LIST_LIMIT}` : `${applications.length} ${applications.length === 1 ? 'application' : 'applications'}`}
                        {` · ${filters.sort === 'deadline' ? 'deadline soonest first' : 'newest saved first'}`}
                    </p>

                    {/* Phones: one card per application. */}
                    <ul className="divide-y divide-border rounded-lg border border-border md:hidden">
                        {applications.map((application) => (
                            <li key={application.ulid}>
                                <Link href={`/applications/${application.ulid}`} className="block space-y-2 px-4 py-3 hover:bg-surface">
                                    <div className="flex items-start justify-between gap-3">
                                        <RoleCell application={application} />
                                        <StageBadge stage={application.stage} />
                                    </div>
                                    <Readiness application={application} />
                                    <dl className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
                                        <DateItem label="Saved" value={application.createdAt} />
                                        {application.appliedAt && <DateItem label="Applied" value={application.appliedAt} />}
                                        {OPEN_STAGES.includes(application.stage) && application.deadlineOn && (
                                            <div className="flex gap-1">
                                                <dt>Deadline</dt>
                                                <dd>
                                                    <Deadline on={application.deadlineOn} />
                                                </dd>
                                            </div>
                                        )}
                                    </dl>
                                </Link>
                            </li>
                        ))}
                    </ul>

                    {/* Wider screens: a table, the whole row opening the application. */}
                    <div className="hidden overflow-hidden rounded-lg border border-border md:block">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-surface text-xs text-muted">
                                <tr>
                                    <th scope="col" className="px-4 py-2 font-medium">Role</th>
                                    <th scope="col" className="px-3 py-2 font-medium">Stage</th>
                                    <th scope="col" className="px-3 py-2 font-medium">Readiness</th>
                                    <th scope="col" className="px-3 py-2 font-medium whitespace-nowrap" aria-sort={filters.sort === 'deadline' ? 'ascending' : undefined}>
                                        <SortLink filters={filters} sort="deadline" label="Deadline" />
                                    </th>
                                    <th scope="col" className="px-3 py-2 font-medium whitespace-nowrap" aria-sort={filters.sort === 'newest' ? 'descending' : undefined}>
                                        <SortLink filters={filters} sort="newest" label="Saved" />
                                    </th>
                                    <th scope="col" className="px-4 py-2 font-medium whitespace-nowrap">Applied</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {applications.map((application) => (
                                    <tr key={application.ulid} className="relative align-top hover:bg-surface">
                                        <td className="max-w-0 px-4 py-3 lg:w-[34%]">
                                            {/* The link's ::after covers the row, so any cell opens the application. */}
                                            <Link href={`/applications/${application.ulid}`} className="block after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-accent">
                                                <RoleCell application={application} />
                                            </Link>
                                        </td>
                                        <td className="px-3 py-3">
                                            <StageBadge stage={application.stage} />
                                        </td>
                                        <td className="px-3 py-3">
                                            <Readiness application={application} />
                                        </td>
                                        <td className="px-3 py-3 whitespace-nowrap text-muted">
                                            {OPEN_STAGES.includes(application.stage) && application.deadlineOn ? <Deadline on={application.deadlineOn} /> : '—'}
                                        </td>
                                        <td className="px-3 py-3 whitespace-nowrap text-muted">
                                            <DateCell value={application.createdAt} />
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap text-muted">
                                            <DateCell value={application.appliedAt} />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}

type Row = Awaited<ReturnType<typeof listApplications>>[number];

function RoleCell({ application }: { application: Row }) {
    return (
        <div className="min-w-0">
            <p className="truncate font-medium">{application.roleTitle}</p>
            <p className="truncate text-sm text-muted">{[application.companyName ?? 'Company not named', application.location].filter(Boolean).join(' · ')}</p>
        </div>
    );
}

/** Not yet sent stays neutral; sent ones take the colour of how they're going. */
const STAGE_TONES: Record<Stage, string> = {
    saved: 'bg-surface text-foreground ring-border',
    preparing: 'bg-amber-500/10 text-amber-800 ring-amber-500/30 dark:text-amber-300',
    applied: 'bg-blue-500/10 text-blue-800 ring-blue-500/30 dark:text-blue-300',
    interviewing: 'bg-violet-500/10 text-violet-800 ring-violet-500/30 dark:text-violet-300',
    offer: 'bg-green-600/10 text-green-800 ring-green-600/30 dark:text-green-300',
    rejected: 'bg-red-500/10 text-red-800 ring-red-500/30 dark:text-red-300',
    withdrawn: 'bg-surface text-muted ring-border',
};

function StageBadge({ stage }: { stage: Stage }) {
    return <span className={`inline-block shrink-0 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ${STAGE_TONES[stage]}`}>{STAGE_LABELS[stage]}</span>;
}

/** Open applications: ready, or the checks still missing. Sent ones: nothing left to prepare. */
function Readiness({ application }: { application: Row }) {
    if (!OPEN_STAGES.includes(application.stage)) {
        return <span className="text-sm text-muted">—</span>;
    }

    const checks = readinessChecks(application);

    if (isReady(checks)) {
        return <span className="inline-block rounded-full bg-green-600/10 px-2 py-0.5 text-xs font-medium text-green-700 dark:text-green-400">✓ Ready to apply</span>;
    }

    return (
        <ul aria-label={`Missing: ${missingSummary(checks, application)}`} className="flex flex-wrap gap-1 text-xs">
            {checks
                .filter((check) => check.state !== 'not_needed')
                .map((check) => (
                    <CheckChip key={check.key} check={check} changesRequested={application.reviewStatus === 'changes_requested'} />
                ))}
        </ul>
    );
}

/** A date with its exact time on hover, or a dash when there is none. */
function DateCell({ value }: { value: Date | null }) {
    if (value === null) {
        return '—';
    }

    return (
        <time dateTime={value.toISOString()} title={formatDateTime(value)}>
            {formatDate(value)}
        </time>
    );
}

function DateItem({ label, value }: { label: string; value: Date | null }) {
    return (
        <div className="flex gap-1">
            <dt>{label}</dt>
            <dd className="text-foreground">
                <DateCell value={value} />
            </dd>
        </div>
    );
}

/** A column heading that switches the list to its order, keeping the other filters. */
function SortLink({ filters, sort, label }: { filters: ListFilters; sort: ListFilters['sort']; label: string }) {
    const active = filters.sort === sort;

    return (
        <Link href={filterHref(filters, { sort })} className={`inline-flex items-center gap-1 ${active ? 'text-foreground' : 'hover:text-foreground'}`}>
            {label}
            {/* An SVG, not ↑/↓: Windows draws those arrows from its colour emoji font. */}
            <svg aria-hidden="true" viewBox="0 0 12 12" className={`size-3 ${active ? '' : 'opacity-0'} ${sort === 'newest' ? 'rotate-180' : ''}`}>
                <path d="M6 2.5v7M3 5.5l3-3 3 3" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
        </Link>
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
