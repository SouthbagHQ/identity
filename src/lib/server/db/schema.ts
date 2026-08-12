import { sql } from 'drizzle-orm';
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
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

export * from './auth.schema';
