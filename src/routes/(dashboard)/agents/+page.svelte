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
		<div class="button-row">
			<button type="submit">Issue token</button>
		</div>
		{#if form?.created}
			<p class="tiny">Shown once. Copy it now; Southbag stores only its fingerprint.</p>
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
				<article class="app-row">
					<div>
						<strong>{token.name}</strong>
						<p class="tiny">{token.prefix}…</p>
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
