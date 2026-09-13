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
	 * First-party apps. Links go straight to each app's OAuth start route, so an
	 * Identity session here signs the user in there without a landing page.
	 * Branch Locator and Support have no sign-in, so they just open.
	 */
	const southbagApps = [
		{ name: 'Southbag Online Banking', href: 'https://banking.southbag.cc/auth/login' },
		{ name: 'Southbag Drive™', href: 'https://drive.southbag.cc/auth/login' },
		{ name: 'Southbag Office™', href: 'https://office.southbag.cc/auth/login' },
		{ name: 'Southbag Code', href: 'https://code.southbag.cc/auth/login?return_to=/account' },
		{ name: 'Branch Locator', href: 'https://branch-locator.southbag.cc/' },
		{ name: 'Southbag Support', href: 'https://support.southbag.cc/' }
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
	<div class="app-grid">
		{#each southbagApps as app}
			<a class="app-card" href={app.href}>
				<img class="app-logo" alt="" src="/logo.png" />
				{app.name}
			</a>
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
