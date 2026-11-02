<script lang="ts">
	import type { ActionData, PageData } from './$types';
	import { enhance } from '$app/forms';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const state = $derived(form?.state ?? data.state);
	const result = $derived(form?.result);
</script>

<svelte:head>
	<title>Southbag Identity - Account review</title>
</svelte:head>

<h1>Account review</h1>

{#if result?.unfrozen}
	<p role="status">
		Your account has been reviewed and unfrozen. It may take a moment to lift across the services connected to your account.
	</p>
{:else if !state.frozen}
	<p>Your account is not frozen.</p>
{:else}
	<p>
		Your account was frozen{state.frozenAt ? ` on ${new Date(state.frozenAt).toLocaleString('en-AU')}` : ''}.
		Reason: {state.reason ?? 'Not recorded'}.
	</p>
	<p>
		While frozen, the Southbag services connected to your account block you. Answer {state.needed} security questions in a row to
		unfreeze. A wrong answer costs {state.wrongAnswerFee} and starts the count again. When the questions are done,
		the {state.reviewFee} account review fee is charged and the freeze lifts across those services.
	</p>
	<p class="tiny">Correct answers in a row: {Math.min(state.streak, state.needed)} of {state.needed}.</p>

	{#if state.paymentDue}
		<p>Security questions answered. The account review fee ({state.reviewFee}) still has to go through.</p>
		{#if result?.paymentFailed}
			<p role="alert">The payment could not be confirmed. Your account is still frozen; trying again will not charge you twice.</p>
		{/if}
		<form method="post" action="?/retryPayment" use:enhance>
			<button type="submit">Pay {state.reviewFee} and unfreeze</button>
		</form>
	{:else}
		{#if result && !result.correct}
			<p role="alert">Wrong answer. Incorrect security answer fee: {state.wrongAnswerFee}. The count starts again.</p>
		{:else if result?.correct}
			<p role="status">Correct.</p>
		{/if}
		{#if form?.message}
			<p role="alert">{form.message}</p>
		{/if}
		<form method="post" action="?/answer" use:enhance>
			<label>
				{state.question}
				<input name="answer" type="text" autocomplete="off" required />
			</label>
			<button type="submit">Answer</button>
		</form>
	{/if}
{/if}
