import type { User, Session } from 'better-auth';
import { createAuth } from '$lib/server/auth';

// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		interface Locals {
			user?: User;
			session?: Session;
			auth: ReturnType<typeof createAuth>
		}

		// interface Error {}
		// interface PageData {}
		interface Platform {
			env: {
				DB: D1Database;
				WALLETWALLET_API_KEY?: string;
				/** Banking's Billing entrypoint (src/lib/server/banking.ts). */
				BANKING?: import('$lib/server/banking').BankingBilling;
				/** JSON map of service name to bearer secret for the internal freeze API. */
				INTERNAL_API_SECRETS?: string;
			};
			context?: ExecutionContext;
		}
		// interface PageState {}
	}

	interface Window {
		palantir?: {
			capture(event: string, properties?: Record<string, unknown>): void;
			identify(user: { id: string; email?: string | null; name?: string | null }): void;
			reset(): void;
		};
	}
}

export {};
