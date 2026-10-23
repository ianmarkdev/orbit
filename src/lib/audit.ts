import 'server-only';

import type { Tx } from '@/db';
import { auditEvents } from '@/db/schema';
import type { Actor } from '@/lib/auth/actor';

/**
 * Port of Career Engine's AuditLogger::record() for a user actor. Career Engine's activity views
 * read these rows, so actions and metadata keys match Laravel's.
 *
 * `ip_hash` stays null: Laravel keys it with APP_KEY, which must never reach this public app.
 */
export async function recordAudit(
    tx: Tx,
    actor: Actor,
    action: string,
    subject: { type: 'job_application'; id: number },
    metadata: Record<string, unknown> = {},
): Promise<void> {
    await tx.insert(auditEvents).values({
        workspaceId: actor.workspaceId,
        actorUserId: actor.userId,
        actorType: 'user',
        action,
        subjectType: subject.type,
        subjectId: subject.id,
        metadata,
        ipHash: null,
    });
}
