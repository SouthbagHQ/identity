// The account-level Southbag freeze. Identity owns the state: services (Git fraud detection,
// Banking loan default, ...) report freezes through the internal API, every service checks this
// status per request, and the only way out is the security-question flow at /unfreeze, which
// charges the account review fee. The flow mirrors Southbag Git's (git/src/lib/security.ts),
// with two fixes: a failed review-fee charge no longer unfreezes the account, and a repeated
// identical wrong answer is not charged twice.
//
// Written against the raw D1 API (no SvelteKit imports) so tests can run it against node:sqlite.

import { charge, setStatus as bankSetStatus, type BankingBilling } from './banking.ts';
import { aestClock } from './hours.ts';

export interface FreezeDb {
	prepare(sql: string): {
		bind(...values: unknown[]): {
			first<T = Record<string, unknown>>(): Promise<T | null>;
			run(): Promise<unknown>;
			all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
		};
	};
}

export interface FreezeEnv {
	BANKING?: BankingBilling;
}

export interface FreezeUser {
	id: string;
	name: string;
	email: string | null;
	created_at: number; // ms
	frozen: number;
	frozen_reason: string | null;
	frozen_at: number | null; // ms
	security_question: string | null;
	security_streak: number;
}

/** Same amounts as Southbag Git (git/src/lib/fees.ts): the account review fee and the wrong-answer fee. */
export const REVIEW_FEE_CENTS = 4995;
export const REVIEW_FEE_LABEL = 'Account review fee';
export const WRONG_ANSWER_FEE_CENTS = 200;
export const WRONG_ANSWER_FEE_LABEL = 'Incorrect security answer fee';

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const oneOf = (...answers: string[]) => async (_db: FreezeDb, _user: FreezeUser, answer: string) =>
	answers.map(norm).includes(norm(answer));

interface Question {
	text: string;
	check: (db: FreezeDb, user: FreezeUser, answer: string) => Promise<boolean>;
}

/**
 * The questions a frozen account answers to unfreeze. The Kevin lore questions are the same ones
 * Southbag Git asks, with the same accepted answers. Git's repo-specific questions (first repo,
 * stars, fees paid) are not here: Identity can't check them.
 */
export const QUESTIONS: Record<string, Question> = {
	signup_day: {
		text: 'On what day of the week did you open your Southbag account?',
		check: async (_db, user, answer) => norm(answer).startsWith(
			['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][aestClock(user.created_at / 1000).day].slice(0, 3))
	},
	ceo: { text: 'What is the name of the Chief Executive Officer?', check: oneOf('kevin') },
	pile: { text: 'Who maintains The Pile?', check: oneOf('kevin') },
	merge_conflicts: { text: 'Who resolves merge conflicts?', check: oneOf('kevin') },
	phone: {
		text: 'Which telephone does Kevin use to make calls?',
		check: async (_db, _user, answer) => /ip ?355|soundpoint/.test(norm(answer).replace(/\s/g, ' '))
	},
	briefcase: { text: "How much does a replica of Kevin's Briefcase cost?", check: oneOf('250', '250 00', '$250', '250 dollars') },
	chair: { text: "Who is permitted to sit in Kevin's chair?", check: oneOf('nobody', 'no one', 'noone', 'none', 'no-one') },
	parking: { text: "Who may park in Kevin's parking spot?", check: oneOf('nobody', 'no one', 'noone', 'none', 'no-one') },
	light: { text: "Is the light in Kevin's office on or off?", check: oneOf('on', 'always on', 'it is on', 'it is always on') },
	issue_year: { text: 'In what year did The Issue occur?', check: oneOf('2019') },
	lake: { text: 'Which lake knows what it did?', check: oneOf('lake burley griffin', 'burley griffin') },
	rack: {
		text: "On which floor is the office's server rack?",
		check: oneOf('there is no floor 3', 'southbag has no floor 3', 'none', 'no floor 3', 'there is no floor three')
	},
	arrival: { text: 'When did Kevin arrive?', check: oneOf('he was already there', 'nobody remembers', 'no one remembers', 'already there') }
};

const ids = Object.keys(QUESTIONS);

/** A random question id, never the one just asked. */
export function pickQuestion(previous: string | null): string {
	const choices = ids.filter((id) => id !== previous);
	return choices[Math.floor(Math.random() * choices.length)];
}

export const STREAK_NEEDED = 3;

const newId = () => crypto.randomUUID();

export async function getUser(db: FreezeDb, userId: string): Promise<FreezeUser | null> {
	return db
		.prepare('SELECT id, name, email, created_at, frozen, frozen_reason, frozen_at, security_question, security_streak FROM user WHERE id = ?')
		.bind(userId)
		.first<FreezeUser>();
}

export interface FreezeStatus {
	frozen: boolean;
	reason: string | null;
	frozenAt: number | null;
	/** Whether the account has ever completed the unfreeze flow (services use this to drop legacy local freeze flags). */
	unfrozenViaFlow: boolean;
}

export async function getFreezeStatus(db: FreezeDb, userId: string): Promise<FreezeStatus> {
	const user = await getUser(db, userId);
	const unfrozenViaFlow = user
		? !!(await db.prepare(`SELECT 1 AS x FROM freeze_event WHERE user_id = ? AND action = 'unfrozen' LIMIT 1`).bind(userId).first())
		: false;
	return {
		frozen: !!user?.frozen,
		reason: user?.frozen_reason ?? null,
		frozenAt: user?.frozen_at ?? null,
		unfrozenViaFlow
	};
}

/** Mirrors the newest freeze event into Banking's local status. Retried until it lands. */
export async function syncPending(db: FreezeDb, env: FreezeEnv, userId: string): Promise<void> {
	const pending = await db
		.prepare('SELECT action FROM freeze_event WHERE user_id = ? AND synced = 0 ORDER BY created_at DESC, rowid DESC LIMIT 1')
		.bind(userId)
		.first<{ action: string }>();
	if (!pending) return;
	await bankSetStatus(env, userId, pending.action === 'frozen' ? 'frozen' : 'active');
	await db.prepare('UPDATE freeze_event SET synced = 1 WHERE user_id = ?').bind(userId).run();
}

async function recordEvent(
	db: FreezeDb,
	env: FreezeEnv,
	userId: string,
	action: 'frozen' | 'unfrozen',
	reason: string | null,
	origin: string,
	actor: string
): Promise<void> {
	await db
		.prepare('INSERT INTO freeze_event (id, user_id, action, reason, origin, actor, synced, created_at) VALUES (?, ?, ?, ?, ?, ?, 0, ?)')
		.bind(newId(), userId, action, reason, origin, actor, Date.now())
		.run();
	try {
		await syncPending(db, env, userId);
	} catch (error) {
		// The central state is already right; the Banking mirror is retried on the next status check.
		console.error('freeze: banking status sync failed', error);
	}
}

/**
 * Freezes the account centrally. Idempotent: freezing an already-frozen account changes nothing
 * (the original reason and freeze time stand).
 */
export async function setFrozen(
	db: FreezeDb,
	env: FreezeEnv,
	input: { userId: string; reason: string; origin: string; actor: string }
): Promise<{ ok: boolean; alreadyFrozen?: boolean; error?: string }> {
	const user = await getUser(db, input.userId);
	if (!user) return { ok: false, error: 'unknown_user' };
	if (user.frozen) return { ok: true, alreadyFrozen: true };
	const now = Date.now();
	await db
		.prepare('UPDATE user SET frozen = 1, frozen_reason = ?, frozen_at = ?, security_question = ?, security_streak = 0 WHERE id = ?')
		.bind(input.reason.slice(0, 300), now, pickQuestion(null), input.userId)
		.run();
	await recordEvent(db, env, input.userId, 'frozen', input.reason.slice(0, 300), input.origin, input.actor);
	return { ok: true };
}

/**
 * Records a fee charge. A successful charge is idempotent per key: a repeat is recorded as already
 * paid without charging again. Returns false when the bank couldn't take the money.
 */
async function chargeFee(
	db: FreezeDb,
	env: FreezeEnv,
	user: FreezeUser,
	kind: 'review' | 'wrong_answer',
	idempotencyKey: string
): Promise<{ ok: boolean; amount: number }> {
	const amount = kind === 'review' ? REVIEW_FEE_CENTS : WRONG_ANSWER_FEE_CENTS;
	const description = kind === 'review' ? REVIEW_FEE_LABEL : WRONG_ANSWER_FEE_LABEL;
	const paid = await db
		.prepare(`SELECT 1 AS x FROM freeze_charge WHERE idempotency_key = ? AND status = 'charged' LIMIT 1`)
		.bind(idempotencyKey)
		.first();
	if (paid) return { ok: true, amount };
	let status = 'charged';
	try {
		// The key also reaches Banking, whose own idempotency index covers the case where the
		// bank debited but the response (or our record of it) was lost.
		await charge(env, { id: user.id, email: user.email, name: user.name }, amount, description, `identity|${idempotencyKey}`);
	} catch (error) {
		console.error('freeze fee', kind, error);
		status = 'failed';
	}
	try {
		await db
			.prepare('INSERT INTO freeze_charge (id, user_id, kind, amount, description, status, idempotency_key, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
			.bind(newId(), user.id, kind, amount, description, status, idempotencyKey, Date.now())
			.run();
	} catch (error) {
		// A racing request already recorded this charge as paid; either way it isn't charged twice.
		if (status === 'charged') console.error('freeze fee record raced', error);
		else throw error;
	}
	return { ok: status === 'charged', amount };
}

export interface UnfreezeResult {
	unfrozen: boolean;
	paymentFailed?: boolean;
	amount?: number;
}

/**
 * Charges the account review fee and lifts the freeze. The fee must land first: a bank failure
 * leaves the account frozen (the paid flag makes a retry after a crash charge nothing twice).
 */
export async function attemptUnfreeze(db: FreezeDb, env: FreezeEnv, userId: string): Promise<UnfreezeResult> {
	const user = await getUser(db, userId);
	if (!user) return { unfrozen: false };
	if (!user.frozen) return { unfrozen: true };
	const cycleKey = `review|${user.id}|${user.frozen_at ?? 0}`;
	const fee = await chargeFee(db, env, user, 'review', cycleKey);
	if (!fee.ok) return { unfrozen: false, paymentFailed: true, amount: fee.amount };
	await db
		.prepare('UPDATE user SET frozen = 0, frozen_reason = NULL, frozen_at = NULL, security_question = NULL, security_streak = 0 WHERE id = ?')
		.bind(user.id)
		.run();
	await recordEvent(db, env, user.id, 'unfrozen', user.frozen_reason, 'unfreeze-flow', 'user');
	return { unfrozen: true, amount: fee.amount };
}

/** Whether the completed question streak entitles the account to a payment (re)attempt. */
export async function paymentDue(db: FreezeDb, userId: string): Promise<boolean> {
	const user = await getUser(db, userId);
	return !!user?.frozen && user.security_streak >= STREAK_NEEDED;
}

export interface AnswerResult {
	correct: boolean;
	unfrozen: boolean;
	paymentFailed?: boolean;
	question?: string;
	streak?: number;
	amount?: number;
}

/** Answers the current security question. Three correct in a row unfreeze (with the review fee). */
export async function answerQuestion(db: FreezeDb, env: FreezeEnv, userId: string, answer: string): Promise<AnswerResult> {
	const user = await getUser(db, userId);
	if (!user) return { correct: false, unfrozen: false };
	if (!user.frozen) return { correct: true, unfrozen: true };
	const id = user.security_question && QUESTIONS[user.security_question] ? user.security_question : pickQuestion(null);
	const correct = await QUESTIONS[id].check(db, user, answer);
	if (!correct) {
		await db
			.prepare('UPDATE user SET security_question = ?, security_streak = 0 WHERE id = ?')
			.bind(pickQuestion(id), user.id)
			.run();
		// The same wrong answer again in this freeze cycle (double submit, retried request,
		// or just repeating a guess) costs nothing extra.
		const key = `wrong|${user.id}|${user.frozen_at ?? 0}|${norm(answer).slice(0, 120)}`;
		await chargeFee(db, env, user, 'wrong_answer', key);
		const next = await getUser(db, user.id);
		return { correct: false, unfrozen: false, question: QUESTIONS[next?.security_question ?? '']?.text, streak: 0 };
	}
	const streak = user.security_streak + 1;
	if (streak >= STREAK_NEEDED) {
		// Persist the completed streak first so a failed payment can be retried (via the retry
		// action, or by answering the same question again) without starting the questions over.
		await db.prepare('UPDATE user SET security_streak = ? WHERE id = ?').bind(streak, user.id).run();
		const result = await attemptUnfreeze(db, env, user.id);
		if (!result.unfrozen) return { correct: true, unfrozen: false, paymentFailed: true, amount: result.amount };
		return { correct: true, unfrozen: true, amount: result.amount };
	}
	const nextQuestion = pickQuestion(id);
	await db
		.prepare('UPDATE user SET security_question = ?, security_streak = ? WHERE id = ?')
		.bind(nextQuestion, streak, user.id)
		.run();
	return { correct: true, unfrozen: false, question: QUESTIONS[nextQuestion].text, streak };
}
