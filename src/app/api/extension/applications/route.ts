import { parseCaptureRequest } from '@/lib/applications/capture-request';
import * as applications from '@/lib/applications/service';
import { resolveActor } from '@/lib/auth/actor';
import { verifySanctumToken } from '@/lib/auth/sanctum';
import { hit } from '@/lib/rate-limit';

const CAPTURE_ABILITY = 'applications:capture';

/** Comfortably above a 50,000-character description in 4-byte characters, plus the other fields. */
const MAX_BODY_BYTES = 512 * 1024;

/**
 * Career Clipper's endpoint, the same contract as Career Engine's `POST /api/extension/applications`
 * (career-cliper/docs/laravel-api-contract.md): point the extension's address at this app and it
 * keeps working, with the same tokens.
 *
 * Guards in Career Engine's order (auth:sanctum, abilities, verified, tenant,
 * candidate.two-factor, throttle), then validation, then the capture: 201, 409 or 422.
 */
export async function POST(request: Request): Promise<Response> {
    const token = await verifySanctumToken(request.headers.get('authorization'), CAPTURE_ABILITY);

    if (!token.ok) {
        return json({ message: token.message }, token.status);
    }

    const actor = await resolveActor({ userId: token.userId });

    if (!actor.ok) {
        return json({ message: actor.message }, 403);
    }

    const limit = hit(`capture:${actor.actor.userId}`, 30);

    if (!limit.allowed) {
        return json({ message: 'Too Many Attempts.' }, 429, { 'Retry-After': String(limit.retryAfter) });
    }

    const raw = await request.text();

    if (Buffer.byteLength(raw) > MAX_BODY_BYTES) {
        return json({ message: 'The request is too large.' }, 413);
    }

    const parsed = parseCaptureRequest(parseJson(raw));

    if (!parsed.ok) {
        return json({ message: parsed.message, errors: parsed.errors }, 422);
    }

    const result = await applications.captureApplication(actor.actor, parsed.value, appUrl(request));

    return result.kind === 'created'
        ? json({ data: result.application }, 201)
        : json({ message: 'This job listing has already been saved.', existing: result.existing }, 409);
}

/** Invalid or missing JSON reads as no input, as in Laravel: it fails validation with 422. */
function parseJson(raw: string): unknown {
    try {
        return JSON.parse(raw);
    } catch {
        return {};
    }
}

/** The public origin, for the link back to the application. The extension only opens same-origin links. */
function appUrl(request: Request): string {
    return (process.env.APP_URL ?? new URL(request.url).origin).replace(/\/+$/, '');
}

function json(body: unknown, status: number, headers: Record<string, string> = {}): Response {
    return Response.json(body, { status, headers: { 'Cache-Control': 'no-store', ...headers } });
}
