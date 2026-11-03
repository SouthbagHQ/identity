// Personal access tokens for a customer's own agent ("bring your own agent", MCP). The user
// creates and revokes tokens in the dashboard; Southbag services resolve a presented token to the
// account through Identity's internal API (src/routes/api/internal/agent-token/+server.ts), using
// the same INTERNAL_API_SECRETS service credential as the freeze API.
//
// Boundaries, deliberately:
// - Only the SHA-256 hash is stored. The full token is shown once at creation; the dashboard and
//   the internal API only ever see prefixes and hashes. A database dump does not leak usable tokens.
// - Tokens identify the account and nothing more: no scopes, no audience restriction, no expiry in
//   v1. Every service still applies its own sign-in rules (account freeze, fees) per call, and
//   revocation takes effect immediately because services resolve tokens fresh, never cached.
// - Token creation stays in the dashboard (an authenticated browser session). Agents cannot mint
//   tokens, so a leaked agent token cannot bootstrap more access.
//
// Uses the raw D1 API (not drizzle) so the module runs under node:test with the same D1 shim the
// freeze tests use (tests/agent-tokens.test.mjs).

export const AGENT_TOKEN_PREFIX = 'sbag_at_';

const now = () => Date.now();

const base64url = (bytes: Uint8Array) =>
	btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');

const sha256hex = async (value: string) => {
	const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
	return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
};

export const hashAgentToken = sha256hex;

/** A new token: the secret to hand the user once, plus what we store. */
export async function generateAgentToken() {
	const token = AGENT_TOKEN_PREFIX + base64url(crypto.getRandomValues(new Uint8Array(24)));
	return {
		token,
		hash: await sha256hex(token),
		prefix: token.slice(0, AGENT_TOKEN_PREFIX.length + 8) // enough to tell tokens apart, not enough to use
	};
}

export interface AgentTokenRow {
	id: string;
	user_id: string;
	name: string;
	token_hash: string;
	token_prefix: string;
	created_at: number;
	last_used_at: number | null;
	revoked_at: number | null;
}

export async function createAgentToken(db: D1Database, userId: string, name: string) {
	const cleaned = String(name || '').trim().slice(0, 80) || 'Unnamed agent';
	const { token, hash, prefix } = await generateAgentToken();
	const id = crypto.randomUUID();
	await db
		.prepare('INSERT INTO agent_token (id, user_id, name, token_hash, token_prefix, created_at) VALUES (?, ?, ?, ?, ?, ?)')
		.bind(id, userId, cleaned, hash, prefix, now())
		.run();
	return { id, name: cleaned, prefix, token };
}

/** Owner's view: never the hash, and both live and revoked tokens so revocation is visible. */
export async function listAgentTokens(db: D1Database, userId: string) {
	const { results } = await db
		.prepare('SELECT id, name, token_prefix, created_at, last_used_at, revoked_at FROM agent_token WHERE user_id = ? ORDER BY created_at DESC')
		.bind(userId)
		.all<Pick<AgentTokenRow, 'id' | 'name' | 'token_prefix' | 'created_at' | 'last_used_at' | 'revoked_at'>>();
	return results;
}

/** Owner-scoped revoke. Returns false when the token does not belong to the user (or is gone). */
export async function revokeAgentToken(db: D1Database, userId: string, tokenId: string) {
	const result = await db
		.prepare('UPDATE agent_token SET revoked_at = ? WHERE id = ? AND user_id = ? AND revoked_at IS NULL')
		.bind(now(), tokenId, userId)
		.run();
	return Number(result.meta?.changes ?? 0) > 0;
}

/**
 * Resolves a presented token to its row, or null for unknown/revoked. High-entropy tokens are
 * looked up by hash, so timing tells an attacker nothing useful. Records last use (best effort).
 */
export async function resolveAgentToken(db: D1Database, presented: string): Promise<AgentTokenRow | null> {
	if (typeof presented !== 'string' || !presented.startsWith(AGENT_TOKEN_PREFIX)) return null;
	const hash = await sha256hex(presented);
	const row = await db
		.prepare('SELECT * FROM agent_token WHERE token_hash = ? AND revoked_at IS NULL')
		.bind(hash)
		.first<AgentTokenRow>();
	if (!row) return null;
	const usedAt = now();
	try {
		await db.prepare('UPDATE agent_token SET last_used_at = ? WHERE id = ?').bind(usedAt, row.id).run();
		row.last_used_at = usedAt;
	} catch (error) {
		console.error('agent token last_used update failed', error);
	}
	return row;
}
