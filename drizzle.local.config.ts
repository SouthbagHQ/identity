import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { defineConfig } from 'drizzle-kit';

const d1Dir = '.wrangler/state/v3/d1/miniflare-D1DatabaseObject';

const hasExpectedTables = (file: string) => {
	try {
		const output = execFileSync(
			'sqlite3',
			[file, "select name from sqlite_master where type = 'table' and name in ('session', 'oauth_client');"],
			{ encoding: 'utf8' }
		);
		const tables = new Set(output.trim().split(/\s+/).filter(Boolean));
		return tables.has('session') && tables.has('oauth_client');
	} catch {
		return false;
	}
};

const findLocalD1 = () => {
	if (!existsSync(d1Dir)) {
		throw new Error('Local D1 state does not exist yet. Run `bun run dev` or apply local migrations first.');
	}

	const files = readdirSync(d1Dir)
		.filter((file) => file.endsWith('.sqlite') && file !== 'metadata.sqlite')
		.map((file) => join(d1Dir, file))
		.sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);

	const matching = files.find(hasExpectedTables);
	if (matching) return matching;

	const newest = files[0];
	if (newest) return newest;

	throw new Error('No local D1 SQLite database found under .wrangler/state/v3/d1.');
};

export default defineConfig({
	schema: './src/lib/server/db/schema.ts',
	dialect: 'sqlite',
	dbCredentials: {
		url: findLocalD1()
	}
});
