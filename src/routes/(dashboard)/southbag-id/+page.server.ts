import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => ({
	credential: await event.locals.auth.api.getSouthbagId({ headers: event.request.headers })
});
