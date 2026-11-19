<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData, PageServerData } from './$types';

	let { data, form }: { data: PageServerData; form: ActionData } = $props();

	const formatDate = (value: string | null | undefined) => {
		if (!value) return 'Not recorded';
		return new Intl.DateTimeFormat('en', {
			dateStyle: 'medium',
			timeStyle: 'short'
		}).format(new Date(value));
	};
</script>

<svelte:head>
	<title>Southbag Identity - Account</title>
</svelte:head>

<header class="plain-header">
	<div>
		<h1>Account</h1>
	</div>
</header>

<div class="dashboard-grid">
	<div class="bad-card">
		<strong>Name</strong>
		<p class="account-name">{data.account.name}</p>
		<form method="post" action="?/changeName" use:enhance class="form-stack">
			<input name="name" value={data.account.name} maxlength="100" required />
			<button>Change name</button>
		</form>
		{#if form?.nameError}
			<p class="tiny">{form.nameError}</p>
		{:else if form?.nameChanged}
			<p class="tiny">Name updated. Other Southbag services may show it as your sessions refresh. Southbag Social keeps its own display name - change it in Social's settings.</p>
		{/if}
	</div>
	<div class="bad-card">
		<strong>Username</strong>
		<p class="account-name">{data.account.username ?? 'Not chosen'}</p>
		<form method="post" action="?/changeUsername" use:enhance class="form-stack">
			<input
				name="username"
				value={data.account.username ?? ''}
				placeholder="3-20 letters, digits, underscores"
				maxlength="20"
				required
			/>
			<button>{data.account.username ? 'Change username ($1.00)' : 'Choose username'}</button>
		</form>
		<p class="tiny">
			Your username follows you across every Southbag service. The first one is no charge.
			Changing it costs $1.00. Fees are final.
		</p>
		{#if form?.usernameError}
			<p class="tiny">{form.usernameError}</p>
		{:else if form?.usernameChanged}
			<p class="tiny">
				{form?.already
					? 'That is already your username. Kevin noted the enthusiasm.'
					: form?.usernameFee
						? `Username updated. Fee collected: ${form.usernameFee}.`
						: 'Username recorded. The next one costs money.'}
			</p>
		{/if}
	</div>
	<div class="bad-card">
		<strong>Email</strong>
		<p>{data.account.email}</p>
		<p>{data.account.emailVerified ? 'Verified' : 'Not verified'}</p>
	</div>
	<div class="bad-card">
		<strong>Password</strong>
		<p>{data.account.providers.some((provider) => provider.hasPassword) ? 'Configured' : 'Not configured'}</p>
	</div>
	<div class="bad-card">
		<strong>Created</strong>
		<p>{formatDate(data.account.createdAt)}</p>
	</div>
</div>

<div class="bad-panel">
	<strong>Login methods</strong>
	<div class="app-list">
		{#each data.account.providers as provider}
			<article class="app-row">
				<div>
					<strong>{provider.providerId}</strong>
					<p class="tiny">{provider.accountId}</p>
				</div>
			</article>
		{:else}
			<p>No login methods recorded.</p>
		{/each}
	</div>
</div>

<style>
	.account-name {
		overflow-wrap: anywhere;
	}
</style>
