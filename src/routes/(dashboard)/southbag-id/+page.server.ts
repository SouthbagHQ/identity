import { fail, redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { requireUser } from '$lib/server/dashboard';
import { getDb } from '$lib/server/db';
import { southbagIdWalletPass } from '$lib/server/db/schema';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => ({
	credential: await event.locals.auth.api.getSouthbagId({ headers: event.request.headers })
});

export const actions: Actions = {
	wallet: async (event) => {
		const user = requireUser(event);
		const credential = await event.locals.auth.api.getSouthbagId({
			headers: event.request.headers
		});

		if (!credential.enrolled) return fail(400, { walletError: 'Enrol your face first.' });

		const apiKey = event.platform?.env.WALLETWALLET_API_KEY;
		if (!apiKey) return fail(503, { walletError: 'Wallet support is not configured.' });

		const db = getDb(event.platform!.env.DB);
		const [existing] = await db
			.select({ shareUrl: southbagIdWalletPass.shareUrl })
			.from(southbagIdWalletPass)
			.where(eq(southbagIdWalletPass.userId, user.id))
			.limit(1);
		if (existing?.shareUrl) redirect(303, existing.shareUrl);
		if (existing) return fail(409, { walletError: 'Your wallet pass is already being created.' });

		const reservation = await db
			.insert(southbagIdWalletPass)
			.values({ userId: user.id })
			.onConflictDoNothing()
			.returning({ userId: southbagIdWalletPass.userId });
		if (!reservation.length)
			return fail(409, { walletError: 'Your wallet pass is already being created.' });

		let response: Response;
		try {
			response = await fetch('https://api.walletwallet.dev/api/passes', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${apiKey}`
				},
				body: JSON.stringify({
					barcodeValue: credential.faceId,
					barcodeFormat: 'QR',
					logoText: 'Southbag',
					organizationName: 'Southbag',
					colorPreset: 'dark',
					color: '#32BFFF',
					logoURL: 'https://southbag.cc/logo.png',
					iconURL: 'https://southbag.cc/logo.png',
					stripURL: 'https://southbag.cc/logo.png',
					primaryFields: [{ label: 'Email', value: user.email }],
					secondaryFields: [
						{ label: 'Name', value: 'Southbag Customer' },
						{ label: 'Date of birth', value: credential.dateOfBirth }
					],
					headerFields: [{ label: 'Kevin', value: 'Watching' }],
					backFields: [{ label: 'Notifications', value: ' ', changeMessage: '%@' }]
				})
			});
		} catch {
			return fail(502, { walletError: 'Pass creation failed. Contact support before retrying.' });
		}

		if (!response.ok) {
			return fail(502, { walletError: 'Pass creation failed. Contact support before retrying.' });
		}

		let shareUrl: string | undefined;
		try {
			({ shareUrl } = (await response.json()) as { shareUrl?: string });
		} catch {
			return fail(502, { walletError: 'WalletWallet returned an invalid install link.' });
		}
		if (!shareUrl) {
			return fail(502, { walletError: 'WalletWallet returned no install link.' });
		}

		await db
			.update(southbagIdWalletPass)
			.set({ shareUrl })
			.where(eq(southbagIdWalletPass.userId, user.id));

		redirect(303, shareUrl);
	}
};
