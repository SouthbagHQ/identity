import type { LayoutServerLoad } from './$types';
import { requireUser } from '$lib/server/dashboard';
import { getFreezeStatus } from '$lib/server/freeze';

export const load: LayoutServerLoad = async (event) => {
	const user = requireUser(event);
	const freeze = await getFreezeStatus(event.platform!.env.DB, user.id);
	return { user, freeze };
};
