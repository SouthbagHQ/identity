import type { Actions, PageServerLoad } from './$types';
import { deleteApp, getOrigin, getOwnedApps, updateApp } from '$lib/server/dashboard';

export const load: PageServerLoad = async (event) => ({
	apps: await getOwnedApps(event),
	origin: getOrigin(event)
});

export const actions: Actions = {
	updateApp,
	deleteApp
};
