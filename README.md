# identity

SvelteKit app configured for Cloudflare, D1, Drizzle, and Better Auth.

## Cloudflare D1

Create a Cloudflare API token that can edit Workers D1 resources, then add these values to `.env`:

```env
CLOUDFLARE_API_TOKEN="..."
CLOUDFLARE_ACCOUNT_ID="..."
CLOUDFLARE_DATABASE_ID="..."
CLOUDFLARE_D1_TOKEN="..."
```

`CLOUDFLARE_D1_TOKEN` can be the same token as `CLOUDFLARE_API_TOKEN`; Drizzle reads either.

```sh
# Create the database in Cloudflare.
CLOUDFLARE_API_TOKEN=... bunx wrangler d1 create identity

# Copy the returned database_id into wrangler.jsonc and .env as CLOUDFLARE_DATABASE_ID.

# Apply the Drizzle schema to D1.
bun run db:migrate
```

## Developing

Local SvelteKit dev uses the Cloudflare platform proxy from `wrangler.jsonc`, including the `DB` binding:

```sh
bun run dev

# or start and open in a browser
bun run dev -- --open
```

## Building

To create a production version of your app:

```sh
bun run build
```

You can preview the production build with `bun run preview`.

### Public-client account status

`GET /api/account/status` is a read-only endpoint for a signed-in user's OAuth bearer (requires the provider's `openid` userinfo validation). It returns `{ sub, email, frozen }` from the token owner's current user row, with `Cache-Control: no-store`. It does not accept a user ID, cookie-only login, service secret, freeze reason or mutation. Invalid tokens return401; missing/deleted accounts return403; status failures return503. The internal service freeze API and paid recovery remain unchanged. This route is a prerequisite for OS account-freeze gating; deploy it before the dependent OS, only after rollout approval.
