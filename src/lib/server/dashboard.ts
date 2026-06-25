import { fail, redirect, type RequestEvent } from '@sveltejs/kit';
import { and, desc, eq } from 'drizzle-orm';
import { getDb } from '$lib/server/db';
import {
	account,
	oauthApplication,
	oauthConsent,
	session,
	southbagAppTrust,
	user
} from '$lib/server/db/schema';

const serializeDate = (date: Date | null | undefined) => date?.toISOString() ?? null;

const cleanRedirects = (value: FormDataEntryValue | null) =>
	(value?.toString() ?? '')
		.split(/\s|,/)
		.map((url) => url.trim())
		.filter(Boolean);

export const requireUser = (event: RequestEvent) => {
	if (!event.locals.user) {
		redirect(302, '/login');
	}
	return event.locals.user;
};

export const getOrigin = (event: RequestEvent) => new URL(event.request.url).origin;

export const getOwnedApps = async (event: RequestEvent) => {
	requireUser(event);
	const db = getDb(event.platform!.env.DB);
	const rows = await db
		.select({
			clientId: oauthApplication.clientId,
			clientSecret: oauthApplication.clientSecret,
			redirectUrls: oauthApplication.redirectUrls,
			disabled: oauthApplication.disabled,
			createdAt: oauthApplication.createdAt,
			trusted: southbagAppTrust.trusted,
			memo: southbagAppTrust.memo
		})
		.from(oauthApplication)
		.leftJoin(southbagAppTrust, eq(oauthApplication.clientId, southbagAppTrust.clientId))
		.where(eq(oauthApplication.userId, event.locals.user!.id))
		.orderBy(desc(oauthApplication.createdAt));

	return Promise.all(
		rows.map(async (row) => {
			const client = await event.locals.auth.api
				.getOAuthClient({
					headers: event.request.headers,
					params: { id: row.clientId }
				})
				.catch(() => null);

			return {
				...row,
				createdAt: serializeDate(row.createdAt),
				name: client?.name ?? row.clientId,
				icon: client?.icon ?? null
			};
		})
	);
};

export const getAuthorizedApps = async (event: RequestEvent) => {
	requireUser(event);
	const db = getDb(event.platform!.env.DB);
	const rows = await db
		.select({
			clientId: oauthConsent.clientId,
			scopes: oauthConsent.scopes,
			createdAt: oauthConsent.createdAt,
			updatedAt: oauthConsent.updatedAt,
			consentGiven: oauthConsent.consentGiven,
			name: oauthApplication.name,
			icon: oauthApplication.icon,
			redirectUrls: oauthApplication.redirectUrls,
			trusted: southbagAppTrust.trusted,
			memo: southbagAppTrust.memo
		})
		.from(oauthConsent)
		.innerJoin(oauthApplication, eq(oauthConsent.clientId, oauthApplication.clientId))
		.leftJoin(southbagAppTrust, eq(oauthApplication.clientId, southbagAppTrust.clientId))
		.where(and(eq(oauthConsent.userId, event.locals.user!.id), eq(oauthConsent.consentGiven, true)))
		.orderBy(desc(oauthConsent.updatedAt));

	return rows.map((row) => ({
		...row,
		createdAt: serializeDate(row.createdAt),
		updatedAt: serializeDate(row.updatedAt)
	}));
};

export const getActiveSessions = async (event: RequestEvent) => {
	requireUser(event);
	const db = getDb(event.platform!.env.DB);
	const rows = await db
		.select({
			id: session.id,
			token: session.token,
			ipAddress: session.ipAddress,
			userAgent: session.userAgent,
			createdAt: session.createdAt,
			updatedAt: session.updatedAt,
			expiresAt: session.expiresAt
		})
		.from(session)
		.where(eq(session.userId, event.locals.user!.id))
		.orderBy(desc(session.updatedAt));

	const currentToken = event.locals.session?.token;

	return rows.map((row) => ({
		id: row.id,
		ipAddress: row.ipAddress,
		userAgent: row.userAgent,
		createdAt: serializeDate(row.createdAt),
		updatedAt: serializeDate(row.updatedAt),
		expiresAt: serializeDate(row.expiresAt),
		current: row.token === currentToken
	}));
};

export const getAccountProfile = async (event: RequestEvent) => {
	requireUser(event);
	const db = getDb(event.platform!.env.DB);
	const [profile] = await db
		.select({
			id: user.id,
			name: user.name,
			email: user.email,
			emailVerified: user.emailVerified,
			image: user.image,
			twoFactorEnabled: user.twoFactorEnabled,
			createdAt: user.createdAt,
			updatedAt: user.updatedAt
		})
		.from(user)
		.where(eq(user.id, event.locals.user!.id))
		.limit(1);

	const providers = await db
		.select({
			id: account.id,
			providerId: account.providerId,
			accountId: account.accountId,
			hasPassword: account.password
		})
		.from(account)
		.where(eq(account.userId, event.locals.user!.id));

	return {
		...profile,
		twoFactorEnabled: Boolean(profile?.twoFactorEnabled),
		createdAt: serializeDate(profile?.createdAt),
		updatedAt: serializeDate(profile?.updatedAt),
		providers: providers.map((provider) => ({
			id: provider.id,
			providerId: provider.providerId,
			accountId: provider.accountId,
			hasPassword: Boolean(provider.hasPassword)
		}))
	};
};

export const signOut = async (event: RequestEvent) => {
	await event.locals.auth.api.signOut({ headers: event.request.headers });
	redirect(302, '/login');
};

export const createApp = async (event: RequestEvent) => {
	if (!event.locals.user) {
		return fail(401, { message: 'Login first.' });
	}

	const db = getDb(event.platform!.env.DB);
	const formData = await event.request.formData();
	const redirectUrls = cleanRedirects(formData.get('redirectUrls'));
	const name = formData.get('name')?.toString().trim() || 'Southbag unnamed integration';

	if (redirectUrls.length === 0) {
		return fail(400, { message: 'A redirect URL is inconveniently mandatory.' });
	}

	const client = await event.locals.auth.api.registerOAuthApplication({
		headers: event.request.headers,
		body: {
			client_name: name,
			client_uri: formData.get('clientUri')?.toString() || undefined,
			logo_uri: formData.get('icon')?.toString().trim() || undefined,
			redirect_uris: redirectUrls,
			token_endpoint_auth_method: 'client_secret_basic',
			grant_types: ['authorization_code'],
			response_types: ['code'],
			metadata: {
				registered_from: 'southbag dashboard',
				warning: 'self-service registration, obviously'
			}
		}
	});

	await db.insert(southbagAppTrust).values({
		clientId: client.client_id,
		trusted: false,
		trustedBy: 'nobody',
		memo: 'Freshly created and therefore suspicious.'
	});

	return { message: `Created ${name}. Save the client secret now; it may not be shown again.` };
};

export const deleteApp = async (event: RequestEvent) => {
	if (!event.locals.user) {
		return fail(401, { message: 'Login first.' });
	}

	const db = getDb(event.platform!.env.DB);
	const formData = await event.request.formData();
	const clientId = formData.get('clientId')?.toString() ?? '';

	if (!clientId) return fail(400, { message: 'No client id.' });

	const [ownedApp] = await db
		.select({ clientId: oauthApplication.clientId })
		.from(oauthApplication)
		.where(and(eq(oauthApplication.clientId, clientId), eq(oauthApplication.userId, event.locals.user.id)))
		.limit(1);

	if (!ownedApp) return fail(404, { message: 'Not your app.' });

	await db.delete(oauthApplication).where(eq(oauthApplication.clientId, clientId));

	return { message: 'Deleted app. Probably.' };
};
