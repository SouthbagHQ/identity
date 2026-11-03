// Internal service-to-service agent token resolution. A Southbag service receives a customer's
// agent token on its MCP endpoint and asks Identity who it belongs to, fresh on every call (no
// caching: a cached 'valid' answer would be a revocation bypass window).
//
// The token travels in the POST body, never the URL, so it does not land in access logs. Answers
// are deliberately minimal: the account fields a service needs to bill and freeze-check the
// customer, plus token metadata for the service's own logs. Unknown and revoked tokens both answer
// 404 with no detail.
//
// Auth: same INTERNAL_API_SECRETS service credential as the freeze API (src/lib/server/internal-api.ts).
// There is deliberately NO token creation here: agents cannot mint tokens, only use them.

import { json, type RequestHandler } from '@sveltejs/kit';
import { authenticateInternal } from '$lib/server/internal-api';
import { resolveAgentToken } from '$lib/server/agent-tokens';

export const POST: RequestHandler = async (event) => {
	const auth = await authenticateInternal(event);
	if (auth instanceof Response) return auth;
	let body: { token?: unknown };
	try {
		body = await event.request.json();
	} catch {
		return json({ error: 'invalid JSON' }, { status: 400 });
	}
	const token = typeof body.token === 'string' ? body.token : '';
	if (!token) return json({ error: 'token is required' }, { status: 400 });
	const db = event.platform!.env.DB;
	const row = await resolveAgentToken(db, token);
	if (!row) return json({ error: 'unknown_token' }, { status: 404 });
	const user = await db
		.prepare('SELECT id, email, name FROM user WHERE id = ?')
		.bind(row.user_id)
		.first<{ id: string; email: string; name: string }>();
	if (!user) return json({ error: 'unknown_token' }, { status: 404 });
	return json({
		tokenId: row.id,
		tokenName: row.name,
		userId: user.id,
		email: user.email,
		name: user.name
	});
};
