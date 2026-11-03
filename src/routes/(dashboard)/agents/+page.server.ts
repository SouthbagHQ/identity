import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { requireUser, track } from '$lib/server/dashboard';
import { createAgentToken, listAgentTokens, parseScopes, revokeAgentToken } from '$lib/server/agent-tokens';

const serialize = (value: number | Date | null | undefined) =>
	value == null ? null : new Date(value).toISOString();

export const load: PageServerLoad = async (event) => {
	const user = requireUser(event);
	const tokens = await listAgentTokens(event.platform!.env.DB, user.id);
	return {
		tokens: tokens.map((row) => ({
			id: row.id,
			name: row.name,
			prefix: row.token_prefix,
			scopes: parseScopes(row.scopes),
			createdAt: serialize(row.created_at),
			lastUsedAt: serialize(row.last_used_at),
			revokedAt: serialize(row.revoked_at)
		}))
	};
};

export const actions: Actions = {
	create: async (event) => {
		const user = requireUser(event);
		const form = await event.request.formData();
		const name = form.get('name')?.toString() ?? '';
		const created = await createAgentToken(event.platform!.env.DB, user.id, name, form.get('write') === 'on');
		track(event, 'agent_token_created', { token_id: created.id });
		// The full token is returned exactly once, to the owner's browser. It is never stored.
		return { created };
	},
	revoke: async (event) => {
		const user = requireUser(event);
		const tokenId = (await event.request.formData()).get('tokenId')?.toString() ?? '';
		if (!tokenId) return fail(400, { message: 'No token id.' });
		const revoked = await revokeAgentToken(event.platform!.env.DB, user.id, tokenId);
		if (!revoked) return fail(404, { message: 'Not your token.' });
		track(event, 'agent_token_revoked', { token_id: tokenId });
		return { message: 'Token revoked. It stopped working the moment you read this.' };
	}
};
