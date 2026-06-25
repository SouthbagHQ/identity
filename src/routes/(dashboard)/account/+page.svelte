<script lang="ts">
	import type { PageServerData } from './$types';

	let { data }: { data: PageServerData } = $props();

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
		<p>Name, email, password, etc.</p>
	</div>
</header>

<div class="dashboard-grid">
	<div class="bad-card">
		<strong>Name</strong>
		<p>{data.account.name}</p>
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
