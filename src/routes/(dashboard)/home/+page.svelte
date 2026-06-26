<script lang="ts">
	import type { PageServerData } from './$types';

	let { data }: { data: PageServerData } = $props();

	const formatScopes = (value: string | null | undefined) =>
		(value ?? '')
			.split(/\s|,/)
			.map((scope) => scope.trim())
			.filter(Boolean)
			.join(', ');
</script>

<svelte:head>
	<title>Southbag Identity - Home</title>
</svelte:head>

<header class="plain-header">
	<div>
		<h1>Home</h1>
		<p>Your apps</p>
	</div>
</header>

<div class="bad-panel">
	<strong>Your apps</strong>
	<div class="app-list">
		{#each data.authorizedApps as app}
			<article class="app-row">
				<div>
					<strong>{app.name || 'Unnamed app'}</strong>
					<p class="tiny"><strong>client_id:</strong> {app.clientId}</p>
					<p class="tiny"><strong>scopes:</strong> {formatScopes(app.scopes) || 'none'}</p>
				</div>
				<div>
					<a class="button-link" href={app.redirectUrls.split(/\s|,/)[0] || '/home'}>Open</a>
				</div>
			</article>
		{:else}
			<p>No authorized apps yet.</p>
		{/each}
	</div>
</div>
