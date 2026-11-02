// Southbag Online Banking, through a service binding (BANKING in wrangler.jsonc) to its Billing
// entrypoint — RPC between Workers, not reachable from the internet. Same pattern as Southbag Git
// (src/lib/banking.ts there). Without a BANKING binding charges FAIL CLOSED - a missing bank must
// never become a free unfreeze. (Unit tests inject a mock bank; for a local run start banking's
// own `wrangler dev` and the dev registry resolves the binding.)

export interface BankingBilling {
	charge(input: {
		userId: string;
		email: string | null;
		name: string;
		amount: number;
		product: string;
		description: string;
		/** Makes a retried charge a no-op on the Banking side (unique index); see banking's Billing.charge. */
		idempotencyKey?: string;
		/** The freeze-fee exception credential: Banking's FREEZE_FEE_SECRET, held only by Identity.
		 * Required to charge a frozen account, and only for the exact review/wrong-answer fees. */
		feeToken?: string;
	}): Promise<{ balance: number; opened: boolean; duplicate?: boolean }>;
	setStatus(input: {
		userId: string;
		status: 'frozen' | 'active';
		/** ACCOUNT_STATUS_SECRET on the Banking side; only Identity holds it, so other
		 * BANKING-bound services cannot mirror status. */
		token: string;
	}): Promise<{ ok: boolean }>;
}

export interface BankUser {
	id: string;
	email: string | null;
	name: string;
}

export const money = (cents: number) => `${cents < 0 ? '-' : ''}$${(Math.abs(cents) / 100).toFixed(2)}`;

/** The bound Billing entrypoint, or null when running locally without the bank. */
export function bank(env: { BANKING?: BankingBilling }): BankingBilling | null {
	return env.BANKING ?? null;
}

/** Takes `amount` cents from the user's account. Throws only if the bank can't be reached. */
export async function charge(
	env: { BANKING?: BankingBilling; FREEZE_FEE_TOKEN?: string },
	user: BankUser,
	amount: number,
	description: string,
	idempotencyKey?: string
): Promise<{ balance: number | null; opened: boolean }> {
	const billing = bank(env);
	if (!billing) throw new Error('Billing is not configured (BANKING binding missing)');
	const result = await billing.charge({
		userId: user.id,
		email: user.email,
		name: user.name,
		amount,
		product: 'Southbag Identity',
		description,
		idempotencyKey,
		feeToken: env.FREEZE_FEE_TOKEN
	});
	return { balance: result.balance ?? null, opened: result.opened };
}

/** Mirrors the account-level freeze state into Banking's local account status. Throws on failure. */
export async function setStatus(
	env: { BANKING?: BankingBilling; ACCOUNT_STATUS_TOKEN?: string },
	userId: string,
	status: 'frozen' | 'active'
): Promise<void> {
	const billing = bank(env);
	if (!billing) throw new Error('Billing is not configured (BANKING binding missing)');
	// Deploy config: `wrangler secret put ACCOUNT_STATUS_TOKEN`, same value as Banking's
	// ACCOUNT_STATUS_SECRET. Without it Banking refuses the mirror (403 'forbidden').
	await billing.setStatus({ userId, status, token: env.ACCOUNT_STATUS_TOKEN ?? '' });
}
