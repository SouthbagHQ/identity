<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import type { PageServerData } from './$types';

	let { data }: { data: PageServerData } = $props();
	let warningCount = $state(0);
	let busy = $state(false);
	let message = $state('');

	const warnings = Array.from({ length: 20 }, (_, index) => `Southbag Untrusted App Warning ${index + 1}: this application might do financial stuff.`);

	const consent = async (accept: boolean) => {
		busy = true;
		message = accept ? 'Authorising through several suspicious layers...' : 'Denying, but dramatically...';

		const response = await fetch('/api/auth/oauth2/consent', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ accept, consent_code: data.consentCode })
		});

		const payload = (await response.json().catch(() => null)) as { redirectURI?: string; message?: string } | null;
		if (payload?.redirectURI) {
			goto(payload.redirectURI);
			return;
		}

		message = payload?.message || 'Consent endpoint did not know what happened.';
		busy = false;
	};

	const runUntrustedGauntlet = async () => {
		for (const warning of warnings) {
			warningCount += 1;
			alert(warning);
			await new Promise((resolve) => setTimeout(resolve, 25));
		}
		await consent(true);
	};

	onMount(() => {
		if (data.isTrusted) {
			setTimeout(() => consent(true), 350);
		}
	});
</script>

<svelte:head>
	<title>Southbag Consent Dialogues</title>
</svelte:head>

<main class="southbag-page">
	<header class="plain-header">
		<img class="logo-box" alt="Southbag Identity™ Logo" src="/logo.png" />
		<div>
			<h1>Consent???</h1>
			<p>{data.app?.name || data.clientId || 'Mystery app'} wants identity, money, and vibes.</p>
		</div>
		<a class="button-link" href="/">Backend</a>
	</header>

	<section class="dashboard-grid">
		<div class="bad-card">
			<strong>{data.isTrusted ? 'Trusted Backend App' : 'Untrusted App Detected'}</strong>
			<p><strong>User:</strong> {data.user.email}</p>
			<p class="tiny"><strong>client_id:</strong> {data.clientId}</p>
			<p class="tiny"><strong>redirects:</strong> {data.app?.redirectUrls || 'unknown, which is normal'}</p>
			<p><strong>Scopes:</strong> {data.scope || 'openid, probably'}</p>
			<p>{data.app?.memo || 'No backend memo. That is basically a memo.'}</p>

			{#if data.isTrusted}
				<p>Auto-accepting because backend said the word trusted.</p>
			{:else}
				<p>Before continuing, Southbag requires twenty blocking browser dialogues. This makes the app safer by making the user tired.</p>
			{/if}

			<div class="button-row">
				<button disabled={busy || data.isTrusted} onclick={runUntrustedGauntlet}>Accept After 20 Dialogues</button>
				<button disabled={busy} onclick={() => consent(false)}>Deny, maybe</button>
			</div>
			<p>{message}</p>
		</div>

		<aside class="bad-card">
			<strong>Dialogue Counter</strong>
			<p>{warningCount}/20</p>
			<p>Trusted apps skip the counter because the backend console pushed a button.</p>
		</aside>
	</section>

	<div class="dialog-stack" aria-hidden="true">
		{#each warnings.slice(0, warningCount).slice(-8) as warning}
			<div class="fake-dialog">{warning}</div>
		{/each}
	</div>
</main>
