import { fail, redirect } from '@sveltejs/kit';
import { APIError } from 'better-auth/api';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = (event) => {
	if (event.locals.user) {
		return redirect(302, '/home');
	}

	return {};
};

export const actions: Actions = {
	signInEmail: async (event) => {
		const formData = await event.request.formData();
		const email = formData.get('email')?.toString() ?? '';
		const password = formData.get('password')?.toString() ?? '';

		try {
			const result = await event.locals.auth.api.signInEmail({
				headers: event.request.headers,
				body: {
					email,
					password,
					callbackURL: '/home'
				}
			});
			if ('twoFactorRedirect' in result && result.twoFactorRedirect) {
				return { twoFactorRequired: true, message: 'Enter your authenticator code.' };
			}
		} catch (error) {
			if (error instanceof APIError) {
				return fail(400, { message: error.message || 'Signin failed badly' });
			}
			return fail(500, { message: 'Unexpected login failure. Try entering balance?' });
		}

		return redirect(302, '/home');
	},
	verifyTwoFactor: async (event) => {
		const formData = await event.request.formData();
		const code = formData.get('code')?.toString() ?? '';

		try {
			await event.locals.auth.api.verifyTOTP({
				headers: event.request.headers,
				body: {
					code,
					trustDevice: true
				}
			});
		} catch (error) {
			if (error instanceof APIError) {
				return fail(400, { twoFactorRequired: true, message: error.message || 'Invalid authenticator code' });
			}
			return fail(500, { twoFactorRequired: true, message: 'Unexpected 2FA verification failure.' });
		}

		return redirect(302, '/home');
	},
	signUpEmail: async (event) => {
		const formData = await event.request.formData();
		const email = formData.get('email')?.toString() ?? '';
		const password = formData.get('password')?.toString() ?? '';
		const name = formData.get('name')?.toString() || 'Southbag Customer';

		try {
			await event.locals.auth.api.signUpEmail({
				headers: event.request.headers,
				body: {
					email,
					password,
					name,
					callbackURL: '/home'
				}
			});
		} catch (error) {
			if (error instanceof APIError) {
				return fail(400, { message: error.message || 'Registration failed badly' });
			}
			return fail(500, { message: 'Unexpected registration failure. Still probably secure.' });
		}

		return redirect(302, '/home');
	},
	signOut: async (event) => {
		await event.locals.auth.api.signOut({ headers: event.request.headers });
		return redirect(302, '/login');
	}
};
