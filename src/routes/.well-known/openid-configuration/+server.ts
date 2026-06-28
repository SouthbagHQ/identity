import { oauthProviderOpenIdConfigMetadata } from '@better-auth/oauth-provider';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = (event) =>
	oauthProviderOpenIdConfigMetadata(event.locals.auth)(event.request);
