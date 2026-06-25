import type { PageServerLoad } from './$types';
import { getAccountProfile, getActiveSessions, getAuthorizedApps } from '$lib/server/dashboard';

export const load: PageServerLoad = async (event) => ({
	account: await getAccountProfile(event),
	authorizedApps: await getAuthorizedApps(event),
	sessions: await getActiveSessions(event)
});
