import { createAuthMiddleware, getSessionFromCtx } from 'better-auth/api';
import { APIError } from 'better-auth/api';
import type { BetterAuthPlugin } from '@better-auth/core';
import { getRequestEvent } from '$app/server';
import { capture, identify, palantirContext, type CaptureOptions } from '$lib/server/palantir';

type PalantirUser = { id: string; email?: string | null; name?: string | null };

/**
 * Which Better Auth endpoint becomes which Palantir event. Everything that isn't listed is
 * still captured as `auth_<path>` so nothing slips through; the list only gives the
 * important ones readable names and a few extra properties.
 */
const EVENTS: Record<string, string> = {
	'/sign-up/email': 'signed_up',
	'/sign-in/email': 'signed_in',
	'/sign-in/southbag-id': 'signed_in',
	'/sign-out': 'signed_out',
	'/two-factor/enable': 'two_factor_enabled',
	'/two-factor/disable': 'two_factor_disabled',
	'/two-factor/verify-totp': 'two_factor_verified',
	'/two-factor/verify-backup-code': 'two_factor_verified',
	'/two-factor/generate-backup-codes': 'two_factor_backup_codes_generated',
	'/change-password': 'password_changed',
	'/set-password': 'password_set',
	'/request-password-reset': 'password_reset_requested',
	'/forget-password': 'password_reset_requested',
	'/reset-password': 'password_reset',
	'/change-email': 'email_change_requested',
	'/update-user': 'profile_updated',
	'/delete-user': 'account_deleted',
	'/delete-user/callback': 'account_deleted',
	'/revoke-session': 'session_revoked',
	'/revoke-sessions': 'all_sessions_revoked',
	'/revoke-other-sessions': 'other_sessions_revoked',
	'/oauth2/register': 'oauth_client_created',
	'/oauth2/create-client': 'oauth_client_created',
	'/admin/oauth2/create-client': 'oauth_client_created',
	'/oauth2/authorize': 'oauth_authorized',
	'/oauth2/consent': 'oauth_consent_granted',
	'/oauth2/token': 'oauth_token_issued',
	'/oauth2/userinfo': 'oauth_userinfo_read',
	'/southbag-id/enrol': 'southbag_id_enrolled',
	'/southbag-id/forget': 'southbag_id_forgotten'
};

/** Read-only endpoints that fire on every page load — not worth an event each. */
const IGNORED = new Set([
	'/get-session',
	'/list-sessions',
	'/list-accounts',
	'/ok',
	'/error',
	'/southbag-id/credential',
	'/two-factor/get-totp-uri',
	'/jwks',
	'/token',
	'/reference',
	'/generate-openapi-schema'
]);

const METHOD: Record<string, string> = {
	'/sign-in/email': 'password',
	'/sign-in/southbag-id': 'southbag_id',
	'/two-factor/verify-totp': 'totp',
	'/two-factor/verify-backup-code': 'backup_code'
};

const pick = (value: unknown, keys: string[]) => {
	if (!value || typeof value !== 'object') return {};
	const source = value as Record<string, unknown>;
	const result: Record<string, unknown> = {};
	for (const key of keys) if (source[key] !== undefined) result[key] = source[key];
	return result;
};

const toUser = (value: unknown): PalantirUser | null => {
	if (!value || typeof value !== 'object') return null;
	const candidate = value as Record<string, unknown>;
	if (typeof candidate.id !== 'string') return null;
	return {
		id: candidate.id,
		email: typeof candidate.email === 'string' ? candidate.email : null,
		name: typeof candidate.name === 'string' ? candidate.name : null
	};
};

/** SvelteKit's request event, if this endpoint is running inside one. */
const requestEvent = () => {
	try {
		return getRequestEvent();
	} catch {
		return undefined;
	}
};

export const palantirPlugin = (): BetterAuthPlugin => ({
	id: 'palantir',
	hooks: {
		after: [
			{
				matcher(ctx) {
					return Boolean(ctx.path) && !IGNORED.has(ctx.path!);
				},
				handler: createAuthMiddleware(async (ctx) => {
					const path = ctx.path ?? '';
					const returned = ctx.context.returned;
					const failed = returned instanceof APIError;
					const base = EVENTS[path] ?? `auth_${path.replace(/^\//, '').replace(/\//g, '_')}`;

					const event = requestEvent();
					const context = palantirContext(ctx.request ?? ctx.headers ?? new Headers());
					const options: CaptureOptions = {
						context,
						waitUntil: event?.platform?.context?.waitUntil?.bind(event.platform.context)
					};

					// Who did this? The session the endpoint just created beats everything; then the
					// session the endpoint ran under; then whatever SvelteKit resolved for the page.
					let user: PalantirUser | null =
						toUser((ctx.context as { newSession?: { user?: unknown } }).newSession?.user) ??
						toUser((ctx.context as { session?: { user?: unknown } }).session?.user) ??
						toUser(event?.locals?.user);
					if (!user && !failed && path !== '/sign-out') {
						try {
							user = toUser((await getSessionFromCtx(ctx))?.user);
						} catch {
							user = null;
						}
					}

					const body = (ctx.body ?? {}) as Record<string, unknown>;
					const properties: Record<string, unknown> = {
						auth_path: path,
						auth_method: METHOD[path],
						...pick(ctx.query, ['client_id', 'scope', 'response_type']),
						...pick(body, ['client_id', 'grant_type', 'scope', 'accept', 'client_name', 'trustDevice'])
					};
					if (path.startsWith('/sign-in') || path.startsWith('/sign-up') || path.includes('password')) {
						if (typeof body.email === 'string') properties.email = body.email;
					}
					if (path === '/oauth2/register' || path === '/oauth2/create-client') {
						properties.oauth_client_id = (returned as { client_id?: string } | undefined)?.client_id;
					}

					let name = base;
					if (failed) {
						name = `${base}_failed`;
						properties.error_code = (returned as APIError).body?.code ?? (returned as APIError).status;
						properties.error_message = (returned as APIError).message;
						if (base === 'signed_in') name = 'sign_in_failed';
						if (base === 'signed_up') name = 'sign_up_failed';
					} else if (path === '/sign-in/email' && (returned as { twoFactorRedirect?: boolean })?.twoFactorRedirect) {
						name = 'sign_in_two_factor_required';
					} else if (path === '/oauth2/consent' && body.accept === false) {
						name = 'oauth_consent_denied';
					}

					const distinctId = user?.id ?? context.distinctId;
					if (!distinctId) return;

					const pending: Promise<unknown>[] = [];
					// A fresh session means the anonymous browser identity now belongs to this user.
					if (user && !failed && (path.startsWith('/sign-in') || path.startsWith('/sign-up') || path.startsWith('/two-factor/verify'))) {
						pending.push(identify(user.id, { email: user.email, name: user.name }, options));
					}
					pending.push(
						capture(name, distinctId, properties, {
							...options,
							set: user && !failed ? { email: user.email, name: user.name } : undefined
						})
					);
					// With waitUntil the platform keeps these alive after the response; otherwise wait here.
					if (!options.waitUntil) await Promise.all(pending);
				})
			}
		]
	}
});
