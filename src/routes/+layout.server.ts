import type { LayoutServerLoad } from './$types';

/** The signed-in user for Palantir; dashboard routes still gate on their own `requireUser`. */
export const load: LayoutServerLoad = (event) => ({
	user: event.locals.user
		? { id: event.locals.user.id, email: event.locals.user.email, name: event.locals.user.name }
		: null
});
