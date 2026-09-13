<script lang="ts">
	import type { PageServerData } from './$types';

	let { data }: { data: PageServerData } = $props();

	const formatScopes = (value: string | null | undefined) =>
		(value ?? '')
			.split(/\s|,/)
			.map((scope) => scope.trim())
			.filter(Boolean)
			.join(', ');

	/**
	 * First-party apps. Each link goes straight to the app's OAuth start route,
	 * so an Identity session here signs the user in there without a landing page.
	 */
	const southbagApps = [
		{ name: 'Southbag Online Banking', description: 'Accounts, transfers, loans, and fees.', href: 'https://banking.southbag.cc/auth/login' },
		{ name: 'Southbag Drive™', description: '100MB of storage.', href: 'https://drive.southbag.cc/auth/login' },
		{ name: 'Southbag Office™', description: 'Docs, Slides, and Sheets.', href: 'https://office.southbag.cc/auth/login' },
		{ name: 'Southbag Code', description: 'Usage and account for the coding agent.', href: 'https://code.southbag.cc/auth/login?return_to=/account' }
	];

	const appUrl = (redirectUrls: string) => {
		try {
			const host = new URL(redirectUrls.split(/\s|,/)[0]).host;
			return host ? `https://${host}/` : '/home';
		} catch {
			return '/home';
		}
	};
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
	<strong>Southbag apps</strong>
	<div class="app-list">
		{#each southbagApps as app}
			<article class="app-row">
				<div>
					<strong>{app.name}</strong>
					<p class="tiny">{app.description}</p>
				</div>
				<div class="app-actions">
					<a class="button-link" href={app.href}>Open</a>
				</div>
			</article>
		{/each}
	</div>
</div>

<div class="bad-panel">
	<strong>3rd party apps</strong>
	<div class="app-list">
		{#each data.authorizedApps as app}
			<article class="app-row">
				<div>
					<strong>{app.name || 'Unnamed app'}</strong>
					<p class="tiny"><strong>client_id:</strong> {app.clientId}</p>
					<p class="tiny"><strong>scopes:</strong> {formatScopes(app.scopes) || 'none'}</p>
				</div>
				<div class="app-actions">
					<a class="button-link" href={appUrl(app.redirectUrls)}>Open</a>
					<form method="POST" action="?/revokeConsent">
						<input type="hidden" name="clientId" value={app.clientId} />
						<button>Revoke</button>
					</form>
				</div>
			</article>
		{:else}
			<p>No 3rd party apps yet.</p>
		{/each}
	</div>
</div>
