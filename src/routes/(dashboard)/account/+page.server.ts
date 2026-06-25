import type { PageServerLoad } from './$types';
import { getAccountProfile } from '$lib/server/dashboard';

export const load: PageServerLoad = async (event) => ({
	account: await getAccountProfile(event)
});
