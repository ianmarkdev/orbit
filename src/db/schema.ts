import { bigint, bigserial, boolean, char, date, integer, jsonb, pgTable, text, timestamp, varchar } from 'drizzle-orm/pg-core';

import type { ResumeDocument, ResumeFactsSnapshot } from '@/lib/resume/types';

/**
 * The slice of Career Engine's schema this app may touch. Career Engine (Laravel) owns every
 * table and runs every migration; this file only describes the columns the `career_va` role is
 * granted (see db/career_va_role.sql). Never generate or push migrations from here.
 *
 * Only declared columns are ever selected, so a column missing here is a column we cannot read.
 */

const tz = { withTimezone: true, mode: 'date' } as const;

export const users = pgTable('users', {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    name: varchar('name', { length: 255 }).notNull(),
    email: varchar('email', { length: 255 }).notNull(),
    emailVerifiedAt: timestamp('email_verified_at', { mode: 'date' }),
    twoFactorConfirmedAt: timestamp('two_factor_confirmed_at', { mode: 'date' }),
    isActive: boolean('is_active').notNull(),
});

export const workspaceMemberships = pgTable('workspace_memberships', {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    workspaceId: bigint('workspace_id', { mode: 'number' }).notNull(),
    userId: bigint('user_id', { mode: 'number' }).notNull(),
    role: text('role').$type<Role>().notNull(),
});

export const candidateProfiles = pgTable('candidate_profiles', {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    workspaceId: bigint('workspace_id', { mode: 'number' }).notNull(),
});

export const jobApplications = pgTable('job_applications', {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    ulid: char('ulid', { length: 26 }).notNull(),
    workspaceId: bigint('workspace_id', { mode: 'number' }).notNull(),
    candidateProfileId: bigint('candidate_profile_id', { mode: 'number' }).notNull(),
    companyName: text('company_name'),
    roleTitle: text('role_title').notNull(),
    sourceUrl: text('source_url'),
    location: text('location'),
    employmentType: text('employment_type').$type<EmploymentType>(),
    salaryText: text('salary_text'),
    stage: text('stage').$type<Stage>().notNull(),
    reviewStatus: text('review_status').$type<ReviewStatus>().notNull(),
    reviewNote: text('review_note'),
    stageChangedAt: timestamp('stage_changed_at', tz),
    appliedAt: timestamp('applied_at', tz),
    deadlineOn: date('deadline_on', { mode: 'string' }),
    notes: text('notes'),
    source: text('source'),
    subjectLine: text('subject_line'),
    applyRequirement: text('apply_requirement').$type<ApplyRequirement>(),
    proposalAngle: text('proposal_angle'),
    ownerUserId: bigint('owner_user_id', { mode: 'number' }),
    assignedUserId: bigint('assigned_user_id', { mode: 'number' }),
    lockVersion: integer('lock_version').notNull(),
    createdAt: timestamp('created_at', tz),
    updatedAt: timestamp('updated_at', tz),
    deletedAt: timestamp('deleted_at', tz),
});

/** Append-only (a trigger rejects updates): a corrected description is a new row, the newest is current. */
export const jobPostings = pgTable('job_postings', {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    workspaceId: bigint('workspace_id', { mode: 'number' }).notNull(),
    jobApplicationId: bigint('job_application_id', { mode: 'number' }).notNull(),
    rawText: text('raw_text').notNull(),
    rawSha256: char('raw_sha256', { length: 64 }).notNull(),
    capturedBy: bigint('captured_by', { mode: 'number' }),
    capturedAt: timestamp('captured_at', tz),
});

/** The resume tailored for one application. Only the approved version is shown here. */
export const applicationResumes = pgTable('application_resumes', {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    workspaceId: bigint('workspace_id', { mode: 'number' }).notNull(),
    jobApplicationId: bigint('job_application_id', { mode: 'number' }).notNull(),
    status: text('status').$type<'draft' | 'approved'>().notNull(),
    approvedVersionId: bigint('approved_version_id', { mode: 'number' }),
    approvedAt: timestamp('approved_at', tz),
});

/** Append-only. `facts_snapshot` holds the library facts the document points at, as approved. */
export const applicationResumeVersions = pgTable('application_resume_versions', {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    workspaceId: bigint('workspace_id', { mode: 'number' }).notNull(),
    applicationResumeId: bigint('application_resume_id', { mode: 'number' }).notNull(),
    document: jsonb('document').$type<ResumeDocument>().notNull(),
    factsSnapshot: jsonb('facts_snapshot').$type<ResumeFactsSnapshot>().notNull(),
});

/** The questions of one application form, in form order. The cover letter is a question too. */
export const applicationQuestions = pgTable('application_questions', {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    workspaceId: bigint('workspace_id', { mode: 'number' }).notNull(),
    jobApplicationId: bigint('job_application_id', { mode: 'number' }).notNull(),
    origin: text('origin').$type<QuestionOrigin>().notNull(),
    promptText: text('prompt_text').notNull(),
    wordLimit: integer('word_limit'),
    charLimit: integer('char_limit'),
    position: integer('position').notNull(),
});

export const answerDrafts = pgTable('answer_drafts', {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    workspaceId: bigint('workspace_id', { mode: 'number' }).notNull(),
    applicationQuestionId: bigint('application_question_id', { mode: 'number' }).notNull(),
    status: text('status').$type<'draft' | 'approved'>().notNull(),
    approvedVersionId: bigint('approved_version_id', { mode: 'number' }),
    approvedAt: timestamp('approved_at', tz),
});

/** Append-only. */
export const answerDraftVersions = pgTable('answer_draft_versions', {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    workspaceId: bigint('workspace_id', { mode: 'number' }).notNull(),
    answerDraftId: bigint('answer_draft_id', { mode: 'number' }).notNull(),
    body: text('body').notNull(),
});

/** Append-only. `career_va` may insert but not read. */
export const auditEvents = pgTable('audit_events', {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    workspaceId: bigint('workspace_id', { mode: 'number' }).notNull(),
    actorUserId: bigint('actor_user_id', { mode: 'number' }),
    actorType: text('actor_type').$type<'user' | 'system' | 'job'>().notNull(),
    action: text('action').notNull(),
    subjectType: text('subject_type'),
    subjectId: bigint('subject_id', { mode: 'number' }),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull(),
    ipHash: varchar('ip_hash', { length: 64 }),
});

/** Sanctum tokens, issued by `php artisan app:extension-token` in Career Engine. */
export const personalAccessTokens = pgTable('personal_access_tokens', {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    tokenableType: varchar('tokenable_type', { length: 255 }).notNull(),
    tokenableId: bigint('tokenable_id', { mode: 'number' }).notNull(),
    token: varchar('token', { length: 64 }).notNull(),
    abilities: text('abilities'),
    lastUsedAt: timestamp('last_used_at', tz),
    expiresAt: timestamp('expires_at', tz),
    updatedAt: timestamp('updated_at', tz),
});

// Mirrors App\Domain\Tenancy\Role, ApplicationStage, ReviewStatus and Knowledge\EmploymentType.
// The database CHECK constraints are the source of truth.
export type Role = 'candidate' | 'va';

export type ReviewStatus = 'not_started' | 'in_progress' | 'in_review' | 'changes_requested' | 'approved';

export type QuestionOrigin = 'manual' | 'cover_letter' | 'extracted';

export const STAGES = ['saved', 'preparing', 'applied', 'interviewing', 'offer', 'rejected', 'withdrawn'] as const;
export type Stage = (typeof STAGES)[number];

export const EMPLOYMENT_TYPES = ['full_time', 'part_time', 'contract', 'freelance', 'internship', 'other'] as const;
export type EmploymentType = (typeof EMPLOYMENT_TYPES)[number];

/** What a listing asks for on top of the application itself. */
export const APPLY_REQUIREMENTS = ['video', 'test', 'video_and_test'] as const;
export type ApplyRequirement = (typeof APPLY_REQUIREMENTS)[number];
