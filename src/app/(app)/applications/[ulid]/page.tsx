import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { isReady, readinessChecks } from '@/lib/applications/readiness';
import { findApplication, findApplicationPack } from '@/lib/applications/service';
import { requireActor } from '@/lib/auth/session';
import { indexLibrary, resumeToPlainText } from '@/lib/resume/document';

import { STAGE_LABELS, formatDate } from '../../stages';
import { CopyButton } from './copy-button';
import { ResumePreview } from './resume-preview';
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

    const pack = await findApplicationPack(actor, application.id);
    const resume = pack.resume && { ...pack.resume, index: indexLibrary(pack.resume.factsSnapshot.library) };

    const facts: [string, string | null][] = [
        ['Location', application.location],
        ['Employment', application.employmentType && EMPLOYMENT_LABELS[application.employmentType]],
        ['Salary', application.salaryText],
        ['Deadline', application.deadlineOn && formatDate(application.deadlineOn)],
        ['Saved', formatDate(application.createdAt)],
        ['Applied', application.appliedAt && formatDate(application.appliedAt)],
    ];

    const coverLetters = pack.answers.filter((answer) => answer.origin === 'cover_letter');
    const questions = pack.answers.filter((answer) => answer.origin !== 'cover_letter');
    const checks = readinessChecks({
        reviewStatus: application.reviewStatus,
        resumeApproved: resume !== null,
        coverLetterTotal: coverLetters.length,
        coverLetterApproved: coverLetters.filter((answer) => answer.body !== null).length,
        questionsTotal: questions.length,
        questionsApproved: questions.filter((answer) => answer.body !== null).length,
    });
    const ready = isReady(checks);

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

            <section aria-labelledby="readiness" className={`space-y-3 rounded-lg border p-4 ${ready ? 'border-border' : 'border-amber-500/50'}`}>
                <h2 id="readiness" className="font-medium">
                    {ready ? 'Ready to apply' : 'Not ready to apply yet'}
                </h2>
                <ul className="grid gap-2 text-sm sm:grid-cols-4">
                    {checks.map((check) => (
                        <li key={check.key} className="flex items-start gap-2">
                            <span aria-hidden="true" className={check.state === 'done' ? 'text-green-600' : 'text-muted'}>
                                {check.state === 'done' ? '✓' : check.state === 'missing' ? '○' : '–'}
                            </span>
                            <span>
                                <span className="font-medium">{check.label}</span>
                                <span className="block text-muted">{check.detail}</span>
                            </span>
                        </li>
                    ))}
                </ul>
                {application.reviewStatus === 'changes_requested' && application.reviewNote && (
                    <p className="rounded-md bg-surface p-3 text-sm whitespace-pre-wrap">
                        <span className="font-medium">Changes requested: </span>
                        {application.reviewNote}
                    </p>
                )}
                {!ready && <p className="text-sm text-muted">Only approved material is shown. Anything still missing is finished in Career Engine.</p>}
            </section>

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

            <section className="space-y-3">
                <h2 className="font-medium">How to apply</h2>
                <dl className="grid gap-3 rounded-lg border border-border p-4 text-sm sm:grid-cols-2">
                    <div>
                        <dt className="text-muted">Source</dt>
                        <dd>{application.source ?? '—'}</dd>
                    </div>
                    <div>
                        <dt className="text-muted">Required to apply</dt>
                        <dd>{application.applyRequirement ? APPLY_REQUIREMENT_LABELS[application.applyRequirement] : 'Nothing extra'}</dd>
                    </div>
                    <div className="sm:col-span-2">
                        <dt className="text-muted">Email subject line</dt>
                        <dd className="flex items-start justify-between gap-3">
                            <span className="min-w-0 break-words">{application.subjectLine ?? 'None asked for'}</span>
                            {application.subjectLine && <CopyButton text={application.subjectLine} />}
                        </dd>
                    </div>
                    {application.proposalAngle && (
                        <div className="sm:col-span-2">
                            <dt className="text-muted">Proposal angle</dt>
                            <dd className="whitespace-pre-wrap break-words">{application.proposalAngle}</dd>
                        </div>
                    )}
                </dl>
            </section>

            <section className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="font-medium">Tailored resume</h2>
                    {resume && (
                        <div className="flex gap-2">
                            <CopyButton text={resumeToPlainText(resume.document, resume.factsSnapshot.contact, resume.index)} label="Copy as text" />
                            <Link href={`/applications/${application.ulid}/resume`} className="rounded-md border border-border px-2.5 py-1 text-sm hover:bg-surface">
                                Save as PDF
                            </Link>
                        </div>
                    )}
                </div>
                {resume ? (
                    <ResumePreview document={resume.document} contact={resume.factsSnapshot.contact} index={resume.index} />
                ) : (
                    <p className="rounded-lg border border-dashed border-border px-4 py-6 text-sm text-muted">The tailored resume is not approved yet.</p>
                )}
            </section>

            {pack.answers.length > 0 && (
                <section className="space-y-3">
                    <h2 className="font-medium">Answers</h2>
                    <ol className="space-y-4">
                        {pack.answers.map((answer, i) => (
                            <li key={i} className="space-y-2 rounded-lg border border-border p-4">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <p className="font-medium break-words">{answer.origin === 'cover_letter' ? 'Cover letter' : answer.prompt}</p>
                                        {(answer.wordLimit || answer.charLimit) && (
                                            <p className="text-sm text-muted">
                                                {[answer.wordLimit && `${answer.wordLimit} words max`, answer.charLimit && `${answer.charLimit} characters max`].filter(Boolean).join(' · ')}
                                            </p>
                                        )}
                                    </div>
                                    {answer.body !== null && <CopyButton text={answer.body} />}
                                </div>
                                {answer.body !== null ? (
                                    <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{answer.body}</p>
                                ) : (
                                    <p className="text-sm text-muted">Not approved yet.</p>
                                )}
                            </li>
                        ))}
                    </ol>
                </section>
            )}

            {application.notes && (
                <section className="space-y-2">
                    <h2 className="font-medium">Notes</h2>
                    <div className="rounded-lg border border-border bg-surface p-4 text-sm leading-relaxed whitespace-pre-wrap break-words">{application.notes}</div>
                </section>
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
