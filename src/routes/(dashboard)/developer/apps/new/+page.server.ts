import { redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { createApp, getOrigin, requireUser } from '$lib/server/dashboard';

export const load: PageServerLoad = (event) => {
	requireUser(event);
	return {
		origin: getOrigin(event)
	};
};

export const actions: Actions = {
	createApp: async (event) => {
		const result = await createApp(event);
		if (result && 'status' in result && result.status >= 400) return result;
		redirect(303, '/developer');
	}
};
