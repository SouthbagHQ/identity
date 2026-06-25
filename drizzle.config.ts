import { defineConfig } from 'drizzle-kit';

const isGenerate = process.argv.includes('generate');
const d1Token = process.env.CLOUDFLARE_D1_TOKEN ?? process.env.CLOUDFLARE_API_TOKEN;

if (!isGenerate) {
	if (!process.env.CLOUDFLARE_ACCOUNT_ID) throw new Error('CLOUDFLARE_ACCOUNT_ID is not set');
	if (!process.env.CLOUDFLARE_DATABASE_ID) throw new Error('CLOUDFLARE_DATABASE_ID is not set');
	if (!d1Token) throw new Error('CLOUDFLARE_D1_TOKEN or CLOUDFLARE_API_TOKEN is not set');
}

export default defineConfig({
	schema: './src/lib/server/db/schema.ts',
	dialect: 'sqlite',
	driver: 'd1-http',
	dbCredentials: {
		accountId: process.env.CLOUDFLARE_ACCOUNT_ID ?? '',
		databaseId: process.env.CLOUDFLARE_DATABASE_ID ?? '',
		token: d1Token ?? ''
	},
	verbose: true,
	strict: true
});
