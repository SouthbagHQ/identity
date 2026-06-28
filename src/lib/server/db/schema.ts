import { sql } from 'drizzle-orm';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { oauthClient } from './auth.schema';

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

export * from './auth.schema';
