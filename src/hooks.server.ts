import type { Handle } from '@sveltejs/kit';
import { building } from '$app/environment';
import { createAuth } from '$lib/server/auth';
import { corsHeaders, withCors } from '$lib/server/cors';
import { svelteKitHandler } from 'better-auth/svelte-kit';

const handleBetterAuth: Handle = async ({ event, resolve }) => {
	if (!event.platform?.env?.DB) throw new Error('D1 binding "DB" not found - are you running with wrangler?');

	event.locals.auth = createAuth(event.platform.env.DB);

	const { auth } = event.locals;
	const session = await auth.api.getSession({ headers: event.request.headers });

	if (session) {
		event.locals.session = session.session;
		event.locals.user = session.user;
	}

	if (event.url.pathname.startsWith('/api/auth/')) {
		const origin = event.request.headers.get('origin');

		if (event.request.method === 'OPTIONS') {
			return new Response(null, {
				status: 204,
				headers: corsHeaders(
					origin,
					event.request.headers.get('access-control-request-headers'),
				),
			});
		}

		return withCors(await auth.handler(event.request), origin);
	}

	return svelteKitHandler({ event, resolve, auth, building });
};

export const handle: Handle = handleBetterAuth;
