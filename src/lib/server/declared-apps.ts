export const OFFICE_CLIENT_ID = 'southbag-office';
export const CODE_CLIENT_ID = 'southbag-code';

let ready: Promise<void> | undefined;

const hashSecret = async (secret: string) => {
	const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret)));
	return btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
};

const apps = {
	office: {
		id: OFFICE_CLIENT_ID,
		name: 'Southbag Office',
		uri: 'https://office.southbag.cc',
		icon: 'https://office.southbag.cc/logo.svg',
		redirect: 'https://office.southbag.cc/auth/callback'
	},
	code: {
		id: CODE_CLIENT_ID,
		name: 'Southbag Code',
		uri: 'https://code.southbag.cc',
		icon: null,
		redirect: 'https://code.southbag.cc/auth/callback'
	}
} as const;

const sync = async (db: D1Database, secrets: { office?: string; code?: string }) => {
	const now = Date.now();
	const statements: D1PreparedStatement[] = [];
	for (const key of ['office', 'code'] as const) {
		const secret = secrets[key];
		if (!secret) continue;
		const app = apps[key];
		statements.push(
			db
				.prepare(`INSERT INTO oauth_client (id, client_id, client_secret, disabled, skip_consent, scopes, created_at, updated_at, name, uri, icon, redirect_uris, token_endpoint_auth_method, grant_types, response_types, public, type)
					VALUES (lower(hex(randomblob(16))), ?, ?, 0, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'web')
					ON CONFLICT(client_id) DO UPDATE SET client_secret = excluded.client_secret, disabled = 0, skip_consent = 0, scopes = excluded.scopes, updated_at = excluded.updated_at, name = excluded.name, uri = excluded.uri, icon = excluded.icon, redirect_uris = excluded.redirect_uris, token_endpoint_auth_method = excluded.token_endpoint_auth_method, grant_types = excluded.grant_types, response_types = excluded.response_types, public = 0, type = 'web'`)
				.bind(
					app.id,
					await hashSecret(secret),
					JSON.stringify(['openid', 'profile', 'email']),
					now,
					now,
					app.name,
					app.uri,
					app.icon,
					JSON.stringify([app.redirect]),
					'client_secret_basic',
					JSON.stringify(['authorization_code']),
					JSON.stringify(['code'])
				),
			db
				.prepare(`INSERT INTO southbag_app_trust (client_id, trusted, trusted_by, memo, updated_at)
					VALUES (?, 1, 'backend', 'Built into Southbag Identity.', ?)
					ON CONFLICT(client_id) DO UPDATE SET trusted = 1, trusted_by = 'backend', memo = 'Built into Southbag Identity.', updated_at = excluded.updated_at`)
				.bind(app.id, now)
		);
	}
	if (statements.length) await db.batch(statements);
};

export const syncDeclaredApps = (db: D1Database, secrets: { office?: string; code?: string }) =>
	(ready ??= sync(db, secrets).catch((error) => {
		ready = undefined;
		throw error;
	}));
