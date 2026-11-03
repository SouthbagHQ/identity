import { fail } from '@sveltejs/kit';
import { APIError } from 'better-auth/api';
import { getAccountProfile, requireUser, track } from '$lib/server/dashboard';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => ({
	account: await getAccountProfile(event)
});

export const actions: Actions = {
	changeName: async (event) => {
		requireUser(event);
		const formData = await event.request.formData();
		const name = formData.get('name')?.toString().trim() ?? '';

		if (!name) {
			return fail(400, { nameError: 'Enter a name first.' });
		}
		if (name.length > 100) {
			return fail(400, { nameError: 'That name is too long for the pass.' });
		}

		try {
			await event.locals.auth.api.updateUser({
				headers: event.request.headers,
				body: { name }
			});
		} catch (error) {
			if (error instanceof APIError) {
				return fail(400, { nameError: error.message || 'Name change failed badly' });
			}
			return fail(500, { nameError: 'Unexpected name change failure. Still probably secure.' });
		}

		track(event, 'name_changed');
		return { nameChanged: true };
	}
};
