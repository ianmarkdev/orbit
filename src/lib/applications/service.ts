import 'server-only';

import { createHash } from 'node:crypto';

import { and, asc, desc, eq, isNotNull, isNull, sql } from 'drizzle-orm';
import { ulid } from 'ulid';

import { db, type Tx } from '@/db';
import {
    answerDrafts,
    answerDraftVersions,
    applicationQuestions,
    applicationResumes,
    applicationResumeVersions,
    candidateProfiles,
    jobApplications,
    jobPostings,
    type QuestionOrigin,
    type Stage,
} from '@/db/schema';
import { recordAudit } from '@/lib/audit';
import type { Actor } from '@/lib/auth/actor';
import { sourceUrlKey } from '@/lib/source-url';

import type { ApplicationDetails, CaptureRequest } from './capture-request';

/**
 * Port of the parts of Career Engine's JobApplicationService a VA uses here: capture a listing
 * and move an application between stages. Same rows, same audit events, same advisory lock, so
 * Laravel cannot tell which app wrote a row. Everything is scoped to the actor's workspace.
 */

export type ApplicationSummary = {
    ulid: string;
    url: string;
    company_name: string | null;
    role_title: string;
    stage: Stage;
    deleted: boolean;
};

export type CaptureResult = { kind: 'created'; application: ApplicationSummary } | { kind: 'duplicate'; existing: ApplicationSummary };

/** Stages that mean the application was sent to the employer (ApplicationStage::isSubmitted). */
const SUBMITTED: readonly Stage[] = ['applied', 'interviewing', 'offer'];

const summaryColumns = {
    id: jobApplications.id,
    ulid: jobApplications.ulid,
    companyName: jobApplications.companyName,
    roleTitle: jobApplications.roleTitle,
    stage: jobApplications.stage,
    deletedAt: jobApplications.deletedAt,
};

type SummaryRow = { ulid: string; companyName: string | null; roleTitle: string; stage: Stage; deletedAt: Date | null };

/**
 * Save a captured listing as a new `saved` application. An existing application for the same
 * listing is never changed: the capture is refused unless `allowDuplicate`.
 */
export async function captureApplication(actor: Actor, request: CaptureRequest, appUrl: string): Promise<CaptureResult> {
    return db.transaction(async (tx) => {
        // The lock Laravel takes too, so a double click cannot save the listing twice from either app.
        await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext('job_applications.capture'), ${actor.workspaceId}::int)`);

        const existing = request.details.sourceUrl === null ? null : await findDuplicate(tx, actor.workspaceId, request.details.sourceUrl);

        if (existing !== null && !request.allowDuplicate) {
            return { kind: 'duplicate', existing: summarize(existing, appUrl) };
        }

        const application = await createApplication(tx, actor, request.details, request.jobDescription);

        await recordAudit(tx, actor, 'application.captured', { type: 'job_application', id: application.id }, {
            ...request.captureMetadata,
            duplicate_of: existing?.ulid ?? null,
        });

        return { kind: 'created', application: summarize(application, appUrl) };
    });
}

/**
 * Any stage can move to any other. The first move to a submitted stage records when the
 * application was sent. Deleted applications cannot be moved (JobApplicationPolicy::update).
 *
 * The VA's note (how they applied, a reference number…) goes in the audit event, which Career
 * Engine's activity timeline shows. A note without a stage change is recorded on its own.
 */
export async function changeStage(actor: Actor, applicationUlid: string, stage: Stage, note: string | null = null): Promise<'changed' | 'noted' | 'unchanged' | 'not_found'> {
    return db.transaction(async (tx) => {
        const [application] = await tx
            .select({ id: jobApplications.id, stage: jobApplications.stage, appliedAt: jobApplications.appliedAt })
            .from(jobApplications)
            .where(and(eq(jobApplications.workspaceId, actor.workspaceId), eq(jobApplications.ulid, applicationUlid), isNull(jobApplications.deletedAt)))
            .for('update');

        if (application === undefined) {
            return 'not_found';
        }

        if (application.stage === stage) {
            if (note === null) {
                return 'unchanged';
            }

            await recordAudit(tx, actor, 'application.noted', { type: 'job_application', id: application.id }, { note });

            return 'noted';
        }

        await tx
            .update(jobApplications)
            .set({
                stage,
                stageChangedAt: sql`now()`,
                ...(SUBMITTED.includes(stage) && application.appliedAt === null ? { appliedAt: sql`now()` } : {}),
                lockVersion: sql`${jobApplications.lockVersion} + 1`,
                updatedAt: sql`now()`,
            })
            .where(eq(jobApplications.id, application.id));

        await recordAudit(tx, actor, 'application.stage_changed', { type: 'job_application', id: application.id }, {
            from: application.stage,
            to: stage,
            ...(note === null ? {} : { note }),
        });

        return 'changed';
    });
}

export async function listApplications(actor: Actor, stage: Stage | null) {
    return db
        .select({
            ulid: jobApplications.ulid,
            companyName: jobApplications.companyName,
            roleTitle: jobApplications.roleTitle,
            location: jobApplications.location,
            sourceUrl: jobApplications.sourceUrl,
            stage: jobApplications.stage,
            reviewStatus: jobApplications.reviewStatus,
            deadlineOn: jobApplications.deadlineOn,
            createdAt: jobApplications.createdAt,
        })
        .from(jobApplications)
        .where(
            and(
                eq(jobApplications.workspaceId, actor.workspaceId),
                isNull(jobApplications.deletedAt),
                stage === null ? undefined : eq(jobApplications.stage, stage),
            ),
        )
        .orderBy(desc(jobApplications.createdAt), desc(jobApplications.id))
        .limit(200);
}

export async function findApplication(actor: Actor, applicationUlid: string) {
    const [application] = await db
        .select({
            id: jobApplications.id,
            ulid: jobApplications.ulid,
            companyName: jobApplications.companyName,
            roleTitle: jobApplications.roleTitle,
            sourceUrl: jobApplications.sourceUrl,
            location: jobApplications.location,
            employmentType: jobApplications.employmentType,
            salaryText: jobApplications.salaryText,
            source: jobApplications.source,
            subjectLine: jobApplications.subjectLine,
            applyRequirement: jobApplications.applyRequirement,
            proposalAngle: jobApplications.proposalAngle,
            notes: jobApplications.notes,
            stage: jobApplications.stage,
            reviewStatus: jobApplications.reviewStatus,
            reviewNote: jobApplications.reviewNote,
            appliedAt: jobApplications.appliedAt,
            deadlineOn: jobApplications.deadlineOn,
            createdAt: jobApplications.createdAt,
        })
        .from(jobApplications)
        .where(and(eq(jobApplications.workspaceId, actor.workspaceId), eq(jobApplications.ulid, applicationUlid), isNull(jobApplications.deletedAt)))
        .limit(1);

    if (application === undefined) {
        return null;
    }

    const [posting] = await db
        .select({ rawText: jobPostings.rawText, capturedAt: jobPostings.capturedAt })
        .from(jobPostings)
        .where(and(eq(jobPostings.workspaceId, actor.workspaceId), eq(jobPostings.jobApplicationId, application.id)))
        .orderBy(desc(jobPostings.id))
        .limit(1);

    return { ...application, jobDescription: posting?.rawText ?? null };
}

export type PackAnswer = {
    prompt: string;
    origin: QuestionOrigin;
    wordLimit: number | null;
    charLimit: number | null;
    /** The approved answer, or null while it is not approved. */
    body: string | null;
};

/**
 * What the VA applies with: the approved tailored resume and the approved answers, in form order
 * with the cover letter first. Drafts are never returned: until something is approved in Career
 * Engine it is reported as not ready.
 */
export async function findApplicationPack(actor: Actor, applicationId: number) {
    const [resume] = await db
        .select({ document: applicationResumeVersions.document, factsSnapshot: applicationResumeVersions.factsSnapshot })
        .from(applicationResumes)
        .innerJoin(
            applicationResumeVersions,
            and(eq(applicationResumeVersions.id, applicationResumes.approvedVersionId), eq(applicationResumeVersions.workspaceId, actor.workspaceId)),
        )
        .where(
            and(
                eq(applicationResumes.workspaceId, actor.workspaceId),
                eq(applicationResumes.jobApplicationId, applicationId),
                eq(applicationResumes.status, 'approved'),
            ),
        )
        .limit(1);

    const rows = await db
        .select({
            prompt: applicationQuestions.promptText,
            origin: applicationQuestions.origin,
            wordLimit: applicationQuestions.wordLimit,
            charLimit: applicationQuestions.charLimit,
            status: answerDrafts.status,
            body: answerDraftVersions.body,
        })
        .from(applicationQuestions)
        .leftJoin(answerDrafts, and(eq(answerDrafts.applicationQuestionId, applicationQuestions.id), eq(answerDrafts.workspaceId, actor.workspaceId)))
        .leftJoin(answerDraftVersions, and(eq(answerDraftVersions.id, answerDrafts.approvedVersionId), eq(answerDraftVersions.workspaceId, actor.workspaceId)))
        .where(and(eq(applicationQuestions.workspaceId, actor.workspaceId), eq(applicationQuestions.jobApplicationId, applicationId)))
        .orderBy(sql`${applicationQuestions.origin} = 'cover_letter' DESC`, asc(applicationQuestions.position), asc(applicationQuestions.id));

    const answers: PackAnswer[] = rows.map(({ status, body, ...question }) => ({ ...question, body: status === 'approved' ? body : null }));

    return { resume: resume ?? null, answers };
}

/**
 * DuplicateApplicationDetector::forSourceUrl(): deleted applications count too, so a dismissed
 * listing is not silently saved again. A live match is reported before a deleted one, then the
 * oldest. Compared in code: a workspace holds a few hundred applications at most.
 */
async function findDuplicate(tx: Tx, workspaceId: number, sourceUrl: string) {
    const key = sourceUrlKey(sourceUrl);

    if (key === null) {
        return null;
    }

    const candidates = await tx
        .select({ ...summaryColumns, sourceUrl: jobApplications.sourceUrl })
        .from(jobApplications)
        .where(and(eq(jobApplications.workspaceId, workspaceId), isNotNull(jobApplications.sourceUrl)))
        .orderBy(sql`${jobApplications.deletedAt} IS NOT NULL`, asc(jobApplications.id));

    return candidates.find((candidate) => sourceUrlKey(candidate.sourceUrl ?? '') === key) ?? null;
}

/** JobApplicationService::create() for a `saved` application, with its job description. */
async function createApplication(tx: Tx, actor: Actor, details: ApplicationDetails, jobDescription: string | null) {
    // CandidateProfile::current(): the workspace's first profile.
    const [profile] = await tx
        .select({ id: candidateProfiles.id })
        .from(candidateProfiles)
        .where(eq(candidateProfiles.workspaceId, actor.workspaceId))
        .orderBy(asc(candidateProfiles.id))
        .limit(1);

    if (profile === undefined) {
        throw new Error(`Workspace ${actor.workspaceId} has no candidate profile.`);
    }

    const [application] = await tx
        .insert(jobApplications)
        .values({
            // HasUlids: lowercase Crockford ULIDs.
            ulid: ulid().toLowerCase(),
            workspaceId: actor.workspaceId,
            candidateProfileId: profile.id,
            ...details,
            stage: 'saved',
            reviewStatus: 'not_started',
            stageChangedAt: sql`now()`,
            ownerUserId: actor.userId,
            lockVersion: 0,
            createdAt: sql`now()`,
            updatedAt: sql`now()`,
        })
        .returning(summaryColumns);

    if (jobDescription !== null && jobDescription !== '') {
        await tx.insert(jobPostings).values({
            workspaceId: actor.workspaceId,
            jobApplicationId: application.id,
            rawText: jobDescription,
            rawSha256: createHash('sha256').update(jobDescription).digest('hex'),
            capturedBy: actor.userId,
        });
    }

    await recordAudit(tx, actor, 'application.created', { type: 'job_application', id: application.id }, { stage: 'saved' });

    return application;
}

function summarize(row: SummaryRow, appUrl: string): ApplicationSummary {
    return {
        ulid: row.ulid,
        url: `${appUrl}/applications/${row.ulid}`,
        company_name: row.companyName,
        role_title: row.roleTitle,
        stage: row.stage,
        deleted: row.deletedAt !== null,
    };
}
