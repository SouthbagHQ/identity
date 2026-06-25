import type { LayoutServerLoad } from './$types';
import { requireUser } from '$lib/server/dashboard';

export const load: LayoutServerLoad = (event) => ({
	user: requireUser(event)
});
