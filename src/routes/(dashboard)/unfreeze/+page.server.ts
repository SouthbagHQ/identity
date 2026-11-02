import { fail, type RequestEvent } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { requireUser } from '$lib/server/dashboard';
import { money } from '$lib/server/banking';
import {
	answerQuestion,
	attemptUnfreeze,
	getUser,
	paymentDue,
	pickQuestion,
	QUESTIONS,
	REVIEW_FEE_CENTS,
	STREAK_NEEDED,
	syncPending,
	WRONG_ANSWER_FEE_CENTS
} from '$lib/server/freeze';
import { track } from '$lib/server/dashboard';

type PageEvent = RequestEvent;

const loadState = async (event: PageEvent) => {
	const db = event.platform!.env.DB;
	const user = await getUser(db, event.locals.user!.id);
	if (!user?.frozen) return { frozen: false as const };
	// A freeze from before questions existed (or a backfill) gets one assigned on first view.
	let questionId = user.security_question && QUESTIONS[user.security_question] ? user.security_question : null;
	if (!questionId) {
		questionId = pickQuestion(null);
		await db.prepare('UPDATE user SET security_question = ? WHERE id = ?').bind(questionId, user.id).run();
	}
	return {
		frozen: true as const,
		reason: user.frozen_reason,
		frozenAt: user.frozen_at ? new Date(user.frozen_at).toISOString() : null,
		question: QUESTIONS[questionId].text,
		streak: user.security_streak,
		needed: STREAK_NEEDED,
		paymentDue: user.security_streak >= STREAK_NEEDED,
		reviewFee: money(REVIEW_FEE_CENTS),
		wrongAnswerFee: money(WRONG_ANSWER_FEE_CENTS)
	};
};

export const load: PageServerLoad = async (event) => {
	requireUser(event);
	try {
		await syncPending(event.platform!.env.DB, event.platform!.env, event.locals.user!.id);
	} catch (error) {
		console.error('freeze sync retry failed', error);
	}
	return { state: await loadState(event) };
};

export const actions: Actions = {
	answer: async (event) => {
		requireUser(event);
		const answer = String((await event.request.formData()).get('answer') ?? '');
		if (!answer.trim()) return fail(400, { message: 'Answer the question.' });
		const db = event.platform!.env.DB;
		const result = await answerQuestion(db, event.platform!.env, event.locals.user!.id, answer);
		track(event, result.unfrozen ? 'account_unfrozen' : result.correct ? 'unfreeze_answer_correct' : 'unfreeze_answer_wrong', {
			paymentFailed: result.paymentFailed ?? false
		});
		return { result, state: await loadState(event) };
	},
	retryPayment: async (event) => {
		requireUser(event);
		const db = event.platform!.env.DB;
		if (!(await paymentDue(db, event.locals.user!.id)))
			return fail(400, { message: 'Answer the security questions first.' });
		const result = await attemptUnfreeze(db, event.platform!.env, event.locals.user!.id);
		track(event, result.unfrozen ? 'account_unfrozen' : 'unfreeze_payment_failed', {});
		return { result: { ...result, correct: true }, state: await loadState(event) };
	}
};
