import type { BetterAuthClientPlugin } from 'better-auth/client';
// Type-only import: erased at build time, so the server module never reaches the browser.
import type { southbagId } from '$lib/server/plugins/southbag-id';

/**
 * Client half of the Southbag ID™ plugin.
 *
 * Gives you `authClient.southbagId.enrol()`, `authClient.southbagId.credential()`,
 * `authClient.southbagId.forget()` and `authClient.signIn.southbagId()`.
 */
export const southbagIdClient = () =>
	({
		id: 'southbag-id',
		$InferServerPlugin: {} as ReturnType<typeof southbagId>,
		pathMethods: {
			'/southbag-id/enrol': 'POST',
			'/southbag-id/credential': 'GET',
			'/southbag-id/forget': 'POST',
			'/sign-in/southbag-id': 'POST'
		},
		atomListeners: [
			{
				matcher: (path: string) => path === '/sign-in/southbag-id',
				signal: '$sessionSignal' as const
			}
		]
	}) satisfies BetterAuthClientPlugin;
