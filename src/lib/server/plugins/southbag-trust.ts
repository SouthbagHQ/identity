import { createAuthMiddleware } from '@better-auth/core/api';
import type { BetterAuthPlugin } from '@better-auth/core';
import { eq } from 'drizzle-orm';
import { getDb } from '$lib/server/db';
import { oauthClient, southbagAppTrust } from '$lib/server/db/schema';

const OAUTH_CLIENT_CREATE_PATHS = new Set([
	'/oauth2/create-client',
	'/oauth2/register',
	'/admin/oauth2/create-client'
]);

const OAUTH_AUTHORIZE_PATHS = new Set(['/oauth2/authorize']);

const FIRST_PARTY_DOMAIN = 'southbag.cc';

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

/** `redirect_uris` is stored as JSON, occasionally JSON of JSON. */
const parseRedirectUris = (value: unknown): string[] => {
	for (let i = 0; i < 2 && typeof value === 'string'; i++) {
		try {
			value = JSON.parse(value);
		} catch {
			break;
		}
	}
	return Array.isArray(value) ? value.filter((uri): uri is string => typeof uri === 'string') : [];
};

export const isFirstPartyRedirectUri = (uri: string) => {
	try {
		const { protocol, hostname } = new URL(uri);
		return (
			protocol === 'https:' &&
			(hostname === FIRST_PARTY_DOMAIN || hostname.endsWith(`.${FIRST_PARTY_DOMAIN}`))
		);
	} catch {
		return false;
	}
};

/**
 * Apps that can only ever send the user back to *.southbag.cc are ours, so the
 * consent screen is skipped for them. `skip_consent` is derived purely from the
 * redirect URIs: add a foreign redirect and the consent screen comes back.
 */
export const syncFirstPartySkipConsent = async (d1: D1Database, clientId: string) => {
	const db = getDb(d1);
	const [client] = await db
		.select({ redirectUris: oauthClient.redirectUris, skipConsent: oauthClient.skipConsent })
		.from(oauthClient)
		.where(eq(oauthClient.clientId, clientId))
		.limit(1);
	if (!client) return;

	const redirectUris = parseRedirectUris(client.redirectUris);
	const skipConsent = redirectUris.length > 0 && redirectUris.every(isFirstPartyRedirectUri);
	if (Boolean(client.skipConsent) === skipConsent) return;

	await db
		.update(oauthClient)
		.set({ skipConsent, updatedAt: new Date() })
		.where(eq(oauthClient.clientId, clientId));
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
		before: [
			{
				matcher(ctx) {
					return Boolean(ctx.path && OAUTH_AUTHORIZE_PATHS.has(ctx.path));
				},
				handler: createAuthMiddleware(async (ctx) => {
					if (!d1) return;

					const clientId = ctx.query?.client_id;
					if (typeof clientId !== 'string' || !clientId) return;

					await syncFirstPartySkipConsent(d1, clientId);
				})
			}
		],
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
					await syncFirstPartySkipConsent(d1, clientId);
				})
			}
		]
	}
});
