import { eq } from 'drizzle-orm';
import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getDb } from '$lib/server/db';
import { oauthApplication, southbagAppTrust } from '$lib/server/db/schema';

export const load: PageServerLoad = async (event) => {
	if (!event.locals.user) {
		return redirect(302, `/login?${event.url.searchParams.toString()}`);
	}

	const clientId = event.url.searchParams.get('client_id') ?? '';
	const consentCode = event.url.searchParams.get('consent_code') ?? '';
	const scope = event.url.searchParams.get('scope') ?? '';
	const db = getDb(event.platform!.env.DB);

	const [app] = clientId
		? await db
				.select({
					clientId: oauthApplication.clientId,
					name: oauthApplication.name,
					redirectUrls: oauthApplication.redirectUrls,
					trusted: southbagAppTrust.trusted,
					memo: southbagAppTrust.memo
				})
				.from(oauthApplication)
				.leftJoin(southbagAppTrust, eq(oauthApplication.clientId, southbagAppTrust.clientId))
				.where(eq(oauthApplication.clientId, clientId))
				.limit(1)
		: [];

	return {
		clientId,
		consentCode,
		scope,
		app,
		user: event.locals.user,
		isTrusted: Boolean(app?.trusted)
	};
};
