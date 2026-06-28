import { eq } from 'drizzle-orm';
import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getDb } from '$lib/server/db';
import { oauthClient, southbagAppTrust } from '$lib/server/db/schema';

const serializeList = (value: unknown) => (Array.isArray(value) ? value.join(' ') : '');

export const load: PageServerLoad = async (event) => {
	if (!event.locals.user) {
		return redirect(302, `/login?${event.url.searchParams.toString()}`);
	}

	const clientId = event.url.searchParams.get('client_id') ?? '';
	const scope = event.url.searchParams.get('scope') ?? '';
	const db = getDb(event.platform!.env.DB);

	const [app] = clientId
		? await db
				.select({
					clientId: oauthClient.clientId,
					name: oauthClient.name,
					redirectUris: oauthClient.redirectUris,
					trusted: southbagAppTrust.trusted,
					memo: southbagAppTrust.memo
				})
				.from(oauthClient)
				.leftJoin(southbagAppTrust, eq(oauthClient.clientId, southbagAppTrust.clientId))
				.where(eq(oauthClient.clientId, clientId))
				.limit(1)
		: [];

	return {
		clientId,
		oauthQuery: event.url.searchParams.toString(),
		scope,
		app: app
			? {
					...app,
					redirectUrls: serializeList(app.redirectUris)
				}
			: app,
		user: event.locals.user,
		isTrusted: Boolean(app?.trusted)
	};
};
