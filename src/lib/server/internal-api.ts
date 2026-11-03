// Shared authentication for Identity's internal service-to-service API (/api/internal/*).
//
// Auth: `Authorization: Bearer <secret>` where the secret is one value of the INTERNAL_API_SECRETS
// JSON object ({"southbag-git": "...", "southbag-online-banking": "...", "backfill": "..."}), set
// with `wrangler secret put INTERNAL_API_SECRETS`. The object key becomes the recorded actor, so
// one service can be revoked without rotating the others. Unconfigured = closed (503).

import { json, type RequestEvent } from '@sveltejs/kit';

async function sha256(value: string): Promise<string> {
	const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
	return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** The service name whose configured secret matches the bearer token, or null. */
async function actorFor(env: Record<string, unknown>, token: string): Promise<string | null> {
	const raw = typeof env.INTERNAL_API_SECRETS === 'string' ? env.INTERNAL_API_SECRETS : '';
	if (!raw) return null;
	let secrets: Record<string, string>;
	try {
		secrets = JSON.parse(raw);
	} catch {
		return null;
	}
	const given = await sha256(token);
	for (const [name, secret] of Object.entries(secrets)) {
		if (typeof secret === 'string' && secret && (await sha256(secret)) === given) return name;
	}
	return null;
}

/** The calling service, or the Response to return when it is not authenticated. */
export async function authenticateInternal(event: RequestEvent): Promise<{ actor: string } | Response> {
	const env = (event.platform?.env ?? {}) as Record<string, unknown>;
	const token = event.request.headers.get('authorization')?.match(/^Bearer (.+)$/i)?.[1];
	if (!token) return json({ error: 'unauthorized' }, { status: 401 });
	const actor = await actorFor(env, token);
	if (!actor) {
		const configured = typeof env.INTERNAL_API_SECRETS === 'string' && env.INTERNAL_API_SECRETS.length > 0;
		return json({ error: configured ? 'forbidden' : 'internal API not configured' }, { status: configured ? 403 : 503 });
	}
	return { actor };
}
