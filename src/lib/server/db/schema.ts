import { sql } from 'drizzle-orm';
import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { oauthClient, user } from './auth.schema';

export const task = sqliteTable('task', {
	id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
	title: text('title').notNull(),
	priority: integer('priority').notNull().default(1)
});

export const southbagAppTrust = sqliteTable('southbag_app_trust', {
	clientId: text('client_id')
		.primaryKey()
		.references(() => oauthClient.clientId, { onDelete: 'cascade' }),
	trusted: integer('trusted', { mode: 'boolean' }).default(false).notNull(),
	trustedBy: text('trusted_by').default('backend'),
	memo: text('memo').default('Approved by looking official enough.'),
	updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
		.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
		.$onUpdate(() => new Date())
		.notNull()
});

/**
 * Southbag ID™ face vault. One face and estimated date of birth per customer.
 */
export const southbagIdCredential = sqliteTable(
	'southbag_id_credential',
	{
		id: text('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		faceId: text('face_id').notNull().unique(),
		photo: text('photo').notNull(),
		dateOfBirth: text('date_of_birth').notNull(),
		verdict: text('verdict'),
		createdAt: integer('created_at', { mode: 'timestamp_ms' })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.notNull(),
		updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.$onUpdate(() => new Date())
			.notNull()
	},
	(table) => [index('southbag_id_credential_userId_idx').on(table.userId)]
);

export const southbagIdWalletPass = sqliteTable('southbag_id_wallet_pass', {
	userId: text('user_id')
		.primaryKey()
		.references(() => user.id, { onDelete: 'cascade' }),
	shareUrl: text('share_url'),
	createdAt: integer('created_at', { mode: 'timestamp_ms' })
		.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
		.notNull()
});


/**
 * Account-level freeze history. One row per freeze/unfreeze; `synced` tracks whether the
 * after-state has been mirrored to Southbag Online Banking's local account status.
 */
export const freezeEvent = sqliteTable(
	'freeze_event',
	{
		id: text('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		action: text('action').notNull(), // 'frozen' | 'unfrozen'
		reason: text('reason'),
		origin: text('origin').notNull(), // e.g. 'git-fraud', 'banking-loan-default', 'backfill', 'unfreeze-flow'
		actor: text('actor').notNull(), // internal API service name, or 'user'
		synced: integer('synced', { mode: 'boolean' }).default(false).notNull(),
		createdAt: integer('created_at', { mode: 'timestamp_ms' })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.notNull()
	},
	(table) => [index('freeze_event_userId_idx').on(table.userId, table.createdAt)]
);

/**
 * Fees charged while unfreezing. The partial unique index makes a successful charge
 * idempotent per key; failed attempts may be retried.
 */
export const freezeCharge = sqliteTable(
	'freeze_charge',
	{
		id: text('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		kind: text('kind').notNull(), // 'review' | 'wrong_answer'
		amount: integer('amount').notNull(), // cents
		description: text('description').notNull(),
		status: text('status').notNull(), // 'charged' | 'failed'
		idempotencyKey: text('idempotency_key').notNull(),
		createdAt: integer('created_at', { mode: 'timestamp_ms' })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.notNull()
	},
	(table) => [
		index('freeze_charge_userId_idx').on(table.userId),
		// A successful charge is idempotent per key; failed attempts may be retried.
		uniqueIndex('freeze_charge_charged_key')
			.on(table.idempotencyKey)
			.where(sql`status = 'charged'`)
	]
);


/**
 * Personal access tokens for a customer's own agent (MCP). Only the SHA-256 hash is stored; the
 * full token is shown once at creation. Services resolve tokens through the internal API, fresh on
 * every call, so a revoke here takes effect immediately Southbag-wide.
 */
export const agentToken = sqliteTable(
	'agent_token',
	{
		id: text('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		name: text('name').notNull(),
		tokenHash: text('token_hash').notNull(),
		tokenPrefix: text('token_prefix').notNull(),
		scopes: text('scopes').notNull().default('read'),
		createdAt: integer('created_at', { mode: 'timestamp_ms' })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.notNull(),
		lastUsedAt: integer('last_used_at', { mode: 'timestamp_ms' }),
		revokedAt: integer('revoked_at', { mode: 'timestamp_ms' })
	},
	(table) => [uniqueIndex('agent_token_hash_idx').on(table.tokenHash), index('agent_token_userId_idx').on(table.userId)]
);

export * from './auth.schema';

/**
 * Agent (MCP) call journal: exactly-once semantics for tools/call retries. A row starts 'pending'
 * before any fee moves and ends 'done' with the full result, so a retried Idempotency-Key replays
 * the stored answer instead of charging again. A row left 'pending' is an UNKNOWN outcome: never
 * re-run, reconciliation-required (see src/lib/server/mcp.ts).
 */
export const mcpCall = sqliteTable('mcp_call', {
	idempotencyKey: text('idempotency_key').primaryKey(),
	userId: text('user_id').notNull(),
	tool: text('tool').notNull(),
	argsHash: text('args_hash').notNull().default(''),
	status: text('status').notNull().default('pending'), // 'pending' | 'done'
	response: text('response'),
	createdAt: integer('created_at').notNull(),
	updatedAt: integer('updated_at').notNull()
});
