import type { Actions, PageServerLoad } from './$types';
import { getAuthorizedApps, getOrigin, signOut } from '$lib/server/dashboard';

export const load: PageServerLoad = async (event) => ({
	authorizedApps: await getAuthorizedApps(event),
	origin: getOrigin(event)
});

export const actions: Actions = {
	signOut
};
