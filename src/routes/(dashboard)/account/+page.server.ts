import { fail } from '@sveltejs/kit';
import { APIError } from 'better-auth/api';
import { getAccountProfile, requireUser, track } from '$lib/server/dashboard';
import { charge, money } from '$lib/server/banking';
import type { Actions, PageServerLoad } from './$types';

/** Changing an already-chosen username costs this much. The first one is no charge. */
const USERNAME_FEE_CENTS = 100;
const USERNAME_RE = /^[a-z0-9_]{3,20}$/;

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
	},
	changeUsername: async (event) => {
		const sessionUser = requireUser(event);
		const formData = await event.request.formData();
		const username = formData.get('username')?.toString().trim().toLowerCase() ?? '';

		if (!USERNAME_RE.test(username)) {
			return fail(400, { usernameError: 'Usernames are 3-20 characters: lowercase letters, digits and underscores.' });
		}

		const account = await getAccountProfile(event);
		if (account.username === username) {
			return { usernameChanged: true, usernameFee: null, already: true };
		}

		// The first username is no charge. After that, Kevin charges.
		let fee: string | null = null;
		if (account.username) {
			try {
				await charge(
					event.platform!.env,
					{ id: sessionUser.id, email: sessionUser.email ?? null, name: sessionUser.name },
					USERNAME_FEE_CENTS,
					`Username change: ${account.username} -> ${username}`,
					`identity-username-${sessionUser.id}-${username}`
				);
			} catch {
				return fail(502, { usernameError: 'The bank could not collect the fee. Your username stays as it is.' });
			}
			fee = money(USERNAME_FEE_CENTS);
		}

		try {
			await event.locals.auth.api.updateUser({
				headers: event.request.headers,
				body: { username }
			});
		} catch (error) {
			if (error instanceof APIError) {
				return fail(400, { usernameError: error.message || 'That username is not available.' });
			}
			return fail(500, { usernameError: 'Unexpected username change failure. The fee is final either way.' });
		}

		track(event, 'username_changed');
		return { usernameChanged: true, usernameFee: fee };
	}
};
