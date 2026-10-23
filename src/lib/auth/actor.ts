import 'server-only';

import { eq, sql } from 'drizzle-orm';

import { db } from '@/db';
import { type Role, users, workspaceMemberships } from '@/db/schema';

/** The signed-in Career Engine user and their workspace, the tenant every query is scoped to. */
export type Actor = {
    userId: number;
    name: string;
    email: string;
    workspaceId: number;
    role: Role;
    usesTwoFactor: boolean;
};

export type ActorResult = { ok: true; actor: Actor } | { ok: false; message: string };

/**
 * Career Engine's request guards, in its order: `verified` (email verified), `tenant` (active,
 * with a membership) and `candidate.two-factor` (the candidate must use 2FA). A password check
 * or a Sanctum token only says who someone is; this decides whether they may act.
 */
export async function resolveActor(where: { userId: number } | { email: string }): Promise<ActorResult> {
    const [row] = await db
        .select({
            userId: users.id,
            name: users.name,
            email: users.email,
            emailVerifiedAt: users.emailVerifiedAt,
            twoFactorConfirmedAt: users.twoFactorConfirmedAt,
            isActive: users.isActive,
            workspaceId: workspaceMemberships.workspaceId,
            role: workspaceMemberships.role,
        })
        .from(users)
        .leftJoin(workspaceMemberships, eq(workspaceMemberships.userId, users.id))
        .where('userId' in where ? eq(users.id, where.userId) : eq(sql`lower(${users.email})`, where.email.toLowerCase()))
        .limit(1);

    if (row === undefined) {
        return { ok: false, message: 'There is no Career Engine account for this address.' };
    }

    if (row.emailVerifiedAt === null) {
        return { ok: false, message: 'Your email address is not verified.' };
    }

    if (!row.isActive) {
        return { ok: false, message: 'This account has been deactivated.' };
    }

    if (row.workspaceId === null || row.role === null) {
        return { ok: false, message: 'This account does not belong to a workspace.' };
    }

    if (row.role === 'candidate' && requireCandidateTwoFactor() && row.twoFactorConfirmedAt === null) {
        return { ok: false, message: 'Set up two-factor authentication to continue.' };
    }

    return {
        ok: true,
        actor: {
            userId: row.userId,
            name: row.name,
            email: row.email,
            workspaceId: row.workspaceId,
            role: row.role,
            usesTwoFactor: row.twoFactorConfirmedAt !== null,
        },
    };
}

/** Career Engine's `app.require_candidate_two_factor` (APP_REQUIRE_CANDIDATE_TWO_FACTOR, default true). */
function requireCandidateTwoFactor(): boolean {
    return process.env.REQUIRE_CANDIDATE_TWO_FACTOR !== 'false';
}
