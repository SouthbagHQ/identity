<script lang="ts">
	import type { ActionData, PageServerData } from './$types';
	import { enhance } from '$app/forms';
	import { track } from '$lib/palantir';

	let { data, form }: { data: PageServerData; form: ActionData } = $props();

	const formatDate = (value: string | null | undefined) => {
		if (!value) return 'Never';
		return new Intl.DateTimeFormat('en', {
			dateStyle: 'medium',
			timeStyle: 'short'
		}).format(new Date(value));
	};
</script>

<svelte:head>
	<title>Southbag Identity - Agents</title>
</svelte:head>

<header class="plain-header">
	<div>
		<h1>Agents</h1>
		<p>
			Let your own agent act for you across Southbag services over MCP. Give it a token below and it can
			discover what each service does and what it costs, then take actions on your account. Every action
			is billed to you, itemised on the receipt. Revoking a token stops it everywhere, immediately.
		</p>
	</div>
</header>

<div class="dashboard-grid">
	<form method="post" action="?/create" class="bad-card form-stack" use:enhance={() => { track('agent_token_create_clicked'); }}>
		<strong>New agent token</strong>
		<label>
			Agent name
			<input name="name" type="text" maxlength="80" placeholder="My very competent assistant" />
		</label>
		<fieldset class="form-stack">
			<legend class="tiny">This token may</legend>
			<label class="scope-option">
				<input type="checkbox" name="read" checked disabled />
				<span>Read your data.</span>
			</label>
			<label class="scope-option">
				<input type="checkbox" name="write" />
				<span>Take write actions (post, comment, upload, create documents).</span>
			</label>
			<p class="tiny">Each tool invocation costs $1, plus any standard action fees. Setup and tool discovery are free.</p>
			<p class="tiny">Transfers and payments are not available in this version.</p>
		</fieldset>
		<div class="button-row">
			<button type="submit">Issue token</button>
		</div>
		{#if form?.created}
			<p class="tiny">Shown once. Copy it now; Southbag stores only its fingerprint. This token may: {form.created.scopes.includes('write') ? 'read + write' : 'read only'}.</p>
			<label>
				Token
				<textarea readonly rows="3" value={form.created.token}></textarea>
			</label>
		{/if}
		{#if form?.message}
			<p class="bad-panel">{form.message}</p>
		{/if}
	</form>

	<div class="bad-card">
		<strong>Your agent tokens</strong>
		<div class="app-list">
			{#each data.tokens as token}
				<article class="app-row agent-token-row">
					<div>
						<strong>{token.name}</strong>
						<p class="tiny">{token.prefix}…</p>
						<p class="tiny">May: {token.scopes?.includes('write') ? 'read + write' : 'read only'}</p>
						<p class="tiny">Issued {formatDate(token.createdAt)} · Last used {formatDate(token.lastUsedAt)}</p>
						{#if token.revokedAt}
							<p class="tiny">Revoked {formatDate(token.revokedAt)}</p>
						{/if}
					</div>
					{#if !token.revokedAt}
						<form method="post" action="?/revoke" use:enhance={() => { track('agent_token_revoke_clicked'); }}>
							<input type="hidden" name="tokenId" value={token.id} />
							<button type="submit">Revoke</button>
						</form>
					{/if}
				</article>
			{:else}
				<p>No agent tokens yet.</p>
			{/each}
		</div>
	</div>
</div>

<style>
	/* The shared .app-row splits into content + action columns, which leaves a
	   token row unreadably narrow inside the dashboard grid's side column.
	   Stack the revoke action under the token details instead. */
	.agent-token-row {
		grid-template-columns: minmax(0, 1fr);
	}
	.agent-token-row form {
		justify-self: start;
	}

	/* Give the token list a usable share of the desktop grid. Must stay
	   inside the desktop media query: the global stylesheet collapses
	   .dashboard-grid to one column at <=820px and a scoped rule would
	   otherwise override that and squeeze the mobile layout. */
	@media (min-width: 821px) {
		.dashboard-grid {
			grid-template-columns: minmax(0, 1.25fr) minmax(340px, 1fr);
		}
	}

	/* Scope choices are the important control on this page: make the boxes
	   unmistakable and the rows compact, in the site's outset-border style. */
	fieldset {
		border: 2px ridge #ddd;
		padding: 0.6rem 0.75rem;
	}
	fieldset.form-stack {
		gap: 0.5rem;
	}
	.scope-option {
		display: flex;
		align-items: flex-start;
		gap: 0.6rem;
		transform: none;
		filter: none;
		text-shadow: none;
	}
	.scope-option input[type='checkbox'] {
		appearance: none;
		width: 1.3rem;
		height: 1.3rem;
		flex: none;
		margin: 0.1rem 0 0;
		border: 2px solid #333;
		background: #ffffff;
		box-shadow: 0 0 10px rgb(0 0 0 / 50%);
		display: inline-grid;
		place-content: center;
		cursor: pointer;
	}
	.scope-option input[type='checkbox']:checked {
		background: #cfe3ff;
	}
	.scope-option input[type='checkbox']:checked::after {
		content: 'X';
		font-weight: 700;
		font-size: 1rem;
		line-height: 1;
	}
	.scope-option input[type='checkbox']:disabled {
		cursor: not-allowed;
		opacity: 0.8;
	}
</style>
