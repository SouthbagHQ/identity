import { createAuthMiddleware } from '@better-auth/core/api';
import type { BetterAuthPlugin } from '@better-auth/core';
import { getDb } from '$lib/server/db';
import { southbagAppTrust } from '$lib/server/db/schema';

const OAUTH_CLIENT_CREATE_PATHS = new Set([
	'/oauth2/create-client',
	'/oauth2/register',
	'/admin/oauth2/create-client'
]);

type CreatedOAuthClient = {
	client_id?: string;
	clientId?: string;
	error?: string;
};

const getCreatedClientId = (returned: unknown) => {
	if (!returned || typeof returned !== 'object') return null;
	const value = returned as CreatedOAuthClient;
	if (value.error) return null;
	return value.client_id ?? value.clientId ?? null;
};

export const seedSouthbagAppTrust = async (d1: D1Database, clientId: string) => {
	const db = getDb(d1);
	await db
		.insert(southbagAppTrust)
		.values({
			clientId,
			trusted: false,
			trustedBy: 'nobody',
			memo: 'Freshly created and therefore suspicious.'
		})
		.onConflictDoNothing();
};

export const southbagTrustPlugin = (d1: D1Database | null): BetterAuthPlugin => ({
	id: 'southbag-trust',
	hooks: {
		after: [
			{
				matcher(ctx) {
					return Boolean(ctx.path && OAUTH_CLIENT_CREATE_PATHS.has(ctx.path));
				},
				handler: createAuthMiddleware(async (ctx) => {
					if (!d1) return;

					const clientId = getCreatedClientId(ctx.context.returned);
					if (!clientId) return;

					await seedSouthbagAppTrust(d1, clientId);
				})
			}
		]
	}
});
