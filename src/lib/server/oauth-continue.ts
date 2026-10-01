const DASHBOARD = '/home';

/** Prompts that send the user to the login page; keeping them after login would loop straight back. */
const LOGIN_PROMPTS = new Set(['login', 'create']);

/**
 * When an app's `/oauth2/authorize` request finds nobody logged in, Better Auth
 * sends the user to `/login` with that request's query (plus `exp` and `sig`).
 * Once they are logged in, send them back to `/oauth2/authorize` with the same
 * query so the app's flow carries on instead of dumping them on the dashboard.
 */
export const continueURL = (searchParams: URLSearchParams) => {
	if (!searchParams.has('client_id')) return DASHBOARD;

	const query = new URLSearchParams();
	for (const [key, value] of searchParams) {
		// `sig` and `exp` were added for the login page; `/…` keys are SvelteKit form actions.
		if (key === 'sig' || key === 'exp' || key.startsWith('/')) continue;
		query.append(key, value);
	}

	const prompt = query
		.get('prompt')
		?.split(' ')
		.filter((value) => value && !LOGIN_PROMPTS.has(value));
	if (prompt?.length) query.set('prompt', prompt.join(' '));
	else query.delete('prompt');

	return `/api/auth/oauth2/authorize?${query}`;
};
