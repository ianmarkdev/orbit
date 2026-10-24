import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { findApplication } from '@/lib/applications/service';
import { requireActor } from '@/lib/auth/session';

import { STAGE_LABELS, formatDate } from '../../stages';
import { StageForm } from './stage-form';

export const metadata: Metadata = { title: 'Application · Career VA' };

const EMPLOYMENT_LABELS: Record<string, string> = {
    full_time: 'Full time',
    part_time: 'Part time',
    contract: 'Contract',
    freelance: 'Freelance',
    internship: 'Internship',
    other: 'Other',
};

const APPLY_REQUIREMENT_LABELS: Record<string, string> = {
    video: 'Video',
    test: 'Test',
    video_and_test: 'Video and test',
};

export default async function ApplicationPage({ params }: PageProps<'/applications/[ulid]'>) {
    const actor = await requireActor();
    const { ulid } = await params;
    const application = await findApplication(actor, ulid);

    if (application === null) {
        notFound();
    }

    const facts: [string, string | null][] = [
        ['Location', application.location],
        ['Employment', application.employmentType && EMPLOYMENT_LABELS[application.employmentType]],
        ['Salary', application.salaryText],
        ['Source', application.source],
        ['Subject line', application.subjectLine],
        ['Required to apply', application.applyRequirement && APPLY_REQUIREMENT_LABELS[application.applyRequirement]],
        ['Deadline', application.deadlineOn && formatDate(application.deadlineOn)],
        ['Saved', formatDate(application.createdAt)],
        ['Applied', application.appliedAt && formatDate(application.appliedAt)],
    ];

    return (
        <div className="space-y-8">
            <Link href="/applications" className="text-sm text-muted hover:text-foreground">
                ← Applications
            </Link>

            <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 space-y-1">
                    <h1 className="text-xl font-semibold break-words">{application.roleTitle}</h1>
                    <p className="text-muted">{application.companyName ?? 'Company not named'}</p>
                    {application.sourceUrl && (
                        <a href={application.sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-block text-sm text-accent underline-offset-2 hover:underline">
                            Open listing ↗
                        </a>
                    )}
                </div>
                <StageForm key={application.stage} applicationUlid={application.ulid} stage={application.stage} labels={STAGE_LABELS} />
            </div>

            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
                {facts
                    .filter((fact): fact is [string, string] => Boolean(fact[1]))
                    .map(([label, value]) => (
                        <div key={label}>
                            <dt className="text-muted">{label}</dt>
                            <dd>{value}</dd>
                        </div>
                    ))}
            </dl>

            {(
                [
                    ['Proposal angle', application.proposalAngle],
                    ['Notes', application.notes],
                ] as const
            ).map(
                ([heading, body]) =>
                    body && (
                        <section key={heading} className="space-y-2">
                            <h2 className="font-medium">{heading}</h2>
                            <div className="rounded-lg border border-border bg-surface p-4 text-sm leading-relaxed whitespace-pre-wrap break-words">{body}</div>
                        </section>
                    ),
            )}

            <section className="space-y-2">
                <h2 className="font-medium">Job description</h2>
                {application.jobDescription ? (
                    <div className="rounded-lg border border-border bg-surface p-4 text-sm leading-relaxed whitespace-pre-wrap break-words">
                        {application.jobDescription}
                    </div>
                ) : (
                    <p className="text-sm text-muted">No description was saved with this listing.</p>
                )}
            </section>
        </div>
    );
}
