// Internal service-to-service freeze API. Other Southbag services report freezes here (Git fraud
// detection, Banking loan default) and check this status on every signed-in request. There is
// deliberately NO unfreeze endpoint: unfreezing only happens through the paid security-question
// flow at /unfreeze, so a leaked service secret can freeze (reversible, annoying) but never clear.
//
// Auth: `Authorization: Bearer <secret>` where the secret is one value of the INTERNAL_API_SECRETS
// JSON object ({"southbag-git": "...", "southbag-online-banking": "...", "backfill": "..."}), set
// with `wrangler secret put INTERNAL_API_SECRETS`. The object key becomes the recorded actor, so
// one service can be revoked without rotating the others. Unconfigured = closed (503).

import { json, type RequestHandler } from '@sveltejs/kit';
import { getFreezeStatus, setFrozen, syncPending } from '$lib/server/freeze';

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

async function authenticate(event: Parameters<RequestHandler>[0]): Promise<{ actor: string } | Response> {
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

export const GET: RequestHandler = async (event) => {
	const auth = await authenticate(event);
	if (auth instanceof Response) return auth;
	const userId = event.url.searchParams.get('userId') ?? '';
	if (!userId) return json({ error: 'userId is required' }, { status: 400 });
	const db = event.platform!.env.DB;
	try {
		await syncPending(db, event.platform!.env, userId);
	} catch (error) {
		console.error('freeze sync retry failed', error);
	}
	return json(await getFreezeStatus(db, userId));
};

export const POST: RequestHandler = async (event) => {
	const auth = await authenticate(event);
	if (auth instanceof Response) return auth;
	let body: { userId?: unknown; reason?: unknown; origin?: unknown };
	try {
		body = await event.request.json();
	} catch {
		return json({ error: 'invalid JSON' }, { status: 400 });
	}
	const userId = typeof body.userId === 'string' ? body.userId : '';
	const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
	const origin = typeof body.origin === 'string' ? body.origin.trim() : '';
	if (!userId || !reason || !origin) return json({ error: 'userId, reason and origin are required' }, { status: 400 });
	const result = await setFrozen(event.platform!.env.DB, event.platform!.env, {
		userId,
		reason,
		origin: origin.slice(0, 60),
		actor: auth.actor
	});
	if (!result.ok) return json({ error: result.error }, { status: 404 });
	return json({ frozen: true, alreadyFrozen: result.alreadyFrozen ?? false });
};
