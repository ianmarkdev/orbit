import type { Metadata } from 'next';
import Link from 'next/link';

import { STAGES, type Stage } from '@/db/schema';
import { listApplications } from '@/lib/applications/service';
import { requireActor } from '@/lib/auth/session';

import { STAGE_LABELS, formatDate } from '../stages';

export const metadata: Metadata = { title: 'Applications · Career VA' };

export default async function ApplicationsPage({ searchParams }: PageProps<'/applications'>) {
    const actor = await requireActor();
    const { stage: requested } = await searchParams;
    const stage = typeof requested === 'string' && STAGES.includes(requested as Stage) ? (requested as Stage) : null;
    const applications = await listApplications(actor, stage);

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h1 className="text-xl font-semibold">Applications</h1>
                <p className="text-sm text-muted">Save new listings with the Career Clipper extension.</p>
            </div>

            <nav aria-label="Filter by stage" className="-mx-4 flex gap-1 overflow-x-auto px-4 text-sm [scrollbar-width:none]">
                {[null, ...STAGES].map((option) => (
                    <Link
                        key={option ?? 'all'}
                        href={option === null ? '/applications' : `/applications?stage=${option}`}
                        aria-current={option === stage ? 'page' : undefined}
                        className="shrink-0 rounded-full border border-border px-3 py-1 text-muted aria-[current=page]:border-foreground aria-[current=page]:text-foreground"
                    >
                        {option === null ? 'All' : STAGE_LABELS[option]}
                    </Link>
                ))}
            </nav>

            {applications.length === 0 ? (
                <p className="rounded-lg border border-dashed border-border px-4 py-10 text-center text-sm text-muted">
                    {stage === null ? 'No applications yet.' : `No applications in ${STAGE_LABELS[stage]}.`}
                </p>
            ) : (
                <ul className="divide-y divide-border rounded-lg border border-border">
                    {applications.map((application) => (
                        <li key={application.ulid}>
                            <Link
                                href={`/applications/${application.ulid}`}
                                className="flex flex-col gap-1 px-4 py-3 hover:bg-surface sm:flex-row sm:items-center sm:justify-between sm:gap-4"
                            >
                                <div className="min-w-0">
                                    <p className="truncate font-medium">{application.roleTitle}</p>
                                    <p className="truncate text-sm text-muted">
                                        {[application.companyName ?? 'Company not named', application.location].filter(Boolean).join(' · ')}
                                    </p>
                                </div>
                                <div className="flex shrink-0 items-center gap-3 text-sm text-muted">
                                    {application.deadlineOn && <span>Due {formatDate(application.deadlineOn)}</span>}
                                    <span>Saved {formatDate(application.createdAt)}</span>
                                    <span className="rounded-full bg-surface px-2 py-0.5 text-foreground">{STAGE_LABELS[application.stage]}</span>
                                </div>
                            </Link>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
