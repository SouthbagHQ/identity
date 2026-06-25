import { fail, redirect } from '@sveltejs/kit';
import { and, desc, eq } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';
import { getDb } from '$lib/server/db';
import { oauthApplication, southbagAppTrust } from '$lib/server/db/schema';

const cleanRedirects = (value: FormDataEntryValue | null) =>
	(value?.toString() ?? '')
		.split(/\s|,/)
		.map((url) => url.trim())
		.filter(Boolean);

const getOwnedApps = async (event: Parameters<PageServerLoad>[0]) => {
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
				name: client?.name ?? row.clientId,
				icon: client?.icon ?? null
			};
		})
	);
};

export const load: PageServerLoad = async (event) => {
	if (!event.locals.user) {
		return redirect(302, '/login');
	}

	return {
		user: event.locals.user,
		apps: await getOwnedApps(event),
		origin: new URL(event.request.url).origin
	};
};

export const actions: Actions = {
	signOut: async (event) => {
		await event.locals.auth.api.signOut({ headers: event.request.headers });
		return redirect(302, '/login');
	},
	createApp: async (event) => {
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

		return { message: `Created ${name}. The secret is displayed because this is Southbag.` };
	},
	setTrust: async (event) => {
		if (!event.locals.user) {
			return fail(401, { message: 'Login first.' });
		}

		const db = getDb(event.platform!.env.DB);
		const formData = await event.request.formData();
		const clientId = formData.get('clientId')?.toString() ?? '';
		const trusted = formData.get('trusted') === 'true';

		if (!clientId) return fail(400, { message: 'No client id. Backend confused.' });

		const [ownedApp] = await db
			.select({ clientId: oauthApplication.clientId })
			.from(oauthApplication)
			.where(and(eq(oauthApplication.clientId, clientId), eq(oauthApplication.userId, event.locals.user.id)))
			.limit(1);

		if (!ownedApp) return fail(404, { message: 'Not your app.' });

		await db
			.insert(southbagAppTrust)
			.values({
				clientId,
				trusted,
				trustedBy: event.locals.user?.email ?? 'anonymous backend operator',
				memo: trusted ? 'Trusted by pressing the important button.' : 'Untrusted by vibes.'
			})
			.onConflictDoUpdate({
				target: southbagAppTrust.clientId,
				set: {
					trusted,
					trustedBy: event.locals.user?.email ?? 'anonymous backend operator',
					memo: trusted ? 'Trusted by pressing the important button.' : 'Untrusted by vibes.',
					updatedAt: new Date()
				}
			});

		return { message: trusted ? 'App is now trusted, probably forever.' : 'App is now untrusted and dialogue-heavy.' };
	},
	deleteApp: async (event) => {
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
	}
};
