import 'server-only';

import { createHash, timingSafeEqual } from 'node:crypto';

import { eq, sql } from 'drizzle-orm';

import { db } from '@/db';
import { personalAccessTokens } from '@/db/schema';

/** Laravel's morph map alias for App\Models\User (AppServiceProvider). */
const USER_MORPH = 'user';

export type TokenCheck = { ok: true; userId: number } | { ok: false; status: 401 | 403; message: string };

/**
 * Verifies a Sanctum personal access token the way `auth:sanctum` + `abilities:` do, so the
 * tokens Career Engine issues with `php artisan app:extension-token` work here unchanged.
 *
 * A plain-text token is `{id}|{secret}`; the table stores sha256(secret). Expired tokens are
 * refused (Career Engine sets `sanctum.expiration` to null, so only `expires_at` counts).
 */
export async function verifySanctumToken(authorization: string | null, ability: string): Promise<TokenCheck> {
    const unauthenticated = { ok: false, status: 401, message: 'Unauthenticated.' } as const;
    const plain = /^Bearer\s+(\S+)$/i.exec(authorization ?? '')?.[1];

    if (plain === undefined) {
        return unauthenticated;
    }

    const separator = plain.indexOf('|');
    const id = separator === -1 ? null : Number(plain.slice(0, separator));
    const secret = separator === -1 ? plain : plain.slice(separator + 1);
    const hash = createHash('sha256').update(secret).digest('hex');

    if (id !== null && !Number.isSafeInteger(id)) {
        return unauthenticated;
    }

    const [token] = await db
        .select({
            id: personalAccessTokens.id,
            tokenableType: personalAccessTokens.tokenableType,
            tokenableId: personalAccessTokens.tokenableId,
            token: personalAccessTokens.token,
            abilities: personalAccessTokens.abilities,
            expiresAt: personalAccessTokens.expiresAt,
        })
        .from(personalAccessTokens)
        .where(id === null ? eq(personalAccessTokens.token, hash) : eq(personalAccessTokens.id, id))
        .limit(1);

    if (
        token === undefined ||
        !timingSafeEqual(Buffer.from(token.token.padEnd(64)), Buffer.from(hash)) ||
        token.tokenableType !== USER_MORPH ||
        (token.expiresAt !== null && token.expiresAt.getTime() <= Date.now())
    ) {
        return unauthenticated;
    }

    if (!tokenCan(token.abilities, ability)) {
        return { ok: false, status: 403, message: 'Invalid ability provided.' };
    }

    await db
        .update(personalAccessTokens)
        .set({ lastUsedAt: sql`now()`, updatedAt: sql`now()` })
        .where(eq(personalAccessTokens.id, token.id));

    return { ok: true, userId: token.tokenableId };
}

/** Sanctum's PersonalAccessToken::can(): a JSON list of abilities, `*` meaning all. */
function tokenCan(abilities: string | null, ability: string): boolean {
    try {
        const list: unknown = JSON.parse(abilities ?? '[]');

        return Array.isArray(list) && (list.includes('*') || list.includes(ability));
    } catch {
        return false;
    }
}
