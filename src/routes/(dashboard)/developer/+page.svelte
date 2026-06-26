<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData, PageServerData } from './$types';

	let { data, form }: { data: PageServerData; form: ActionData } = $props();
</script>

<svelte:head>
	<title>Southbag Identity - Developer</title>
</svelte:head>

<header class="plain-header">
	<div>
		<h1>Developer</h1>
	</div>
</header>

{#if form?.message}
	<p class="bad-panel">{form.message}</p>
{/if}

<div class="dashboard-grid">
	<div class="bad-card">
		<strong>OIDC endpoints</strong>
		<p>Authorization endpoint:</p>
		<p class="tiny">{data.origin}/api/auth/oauth2/authorize</p>
		<p>Token endpoint:</p>
		<p class="tiny">{data.origin}/api/auth/oauth2/token</p>
		<p>Scopes:</p>
		<p class="tiny">openid profile email money accounts transfer_everything offline_access</p>
	</div>

	<div class="bad-card form-stack">
		<strong>Create an OIDC app</strong>
		<a class="button-link" href="/developer/apps/new">Create app</a>
		<a href="/api/auth/.well-known/openid-configuration">OIDC Discovery</a>
		<a href="/api/auth/oauth2/register">Register Endpoint</a>
	</div>
</div>

<div class="bad-panel">
	<strong>Your OIDC apps</strong>
	<div class="app-list">
		{#each data.apps as app}
			<article class="app-row">
				<div>
					<strong>{app.name || 'Unnamed app'}</strong>
					<p class="tiny"><strong>client_id:</strong> {app.clientId}</p>
					<p class="tiny"><strong>client_secret:</strong> {app.clientSecret || 'not shown'}</p>
					<p class="tiny"><strong>redirects:</strong> {app.redirectUrls}</p>
					<p><strong>Status:</strong> {app.trusted ? 'trusted by Kevin' : 'not trusted by Kevin'}</p>
				</div>
				<form method="post" action="?/deleteApp" use:enhance class="form-stack">
					<input type="hidden" name="clientId" value={app.clientId} />
					<button>Delete</button>
				</form>
			</article>
		{:else}
			<p>No developer apps yet.</p>
		{/each}
	</div>
</div>
