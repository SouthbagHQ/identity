import type { RequestHandler } from '@sveltejs/kit';
import { accountStatus } from '$lib/server/account-status';

export const GET: RequestHandler = ({ request, locals, platform }) =>
  accountStatus(request, locals.auth, platform!.env.DB);
