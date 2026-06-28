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
		<strong>OAuth/OIDC endpoints</strong>
		<p>Authorization endpoint:</p>
		<p class="tiny">{data.origin}/api/auth/oauth2/authorize</p>
		<p>Token endpoint:</p>
		<p class="tiny">{data.origin}/api/auth/oauth2/token</p>
		<p>Scopes:</p>
		<p class="tiny">openid profile email money accounts transfer_everything offline_access</p>
	</div>

	<div class="bad-card form-stack">
		<strong>Create an OAuth app</strong>
		<a class="button-link" href="/developer/apps/new">Create app</a>
		<a href="/.well-known/openid-configuration">OIDC Discovery</a>
		<a href="/.well-known/oauth-authorization-server">OAuth Metadata</a>
		<a href="/api/auth/oauth2/register">Register Endpoint</a>
	</div>
</div>

<div class="bad-panel">
	<strong>Your OAuth apps</strong>
	<div class="app-list">
		{#each data.apps as app}
			<article class="app-row">
				<form method="post" action="?/updateApp" use:enhance class="form-stack">
					<strong>{app.name || 'Unnamed app'}</strong>
					<p class="tiny"><strong>client_id:</strong> {app.clientId}</p>
					<p class="tiny"><strong>client_secret:</strong> {app.clientSecret || 'missing, somehow'}</p>
					<input type="hidden" name="clientId" value={app.clientId} />
					<label>
						Application name
						<input name="name" value={app.name} required />
					</label>
					<label>
						Homepage URL
						<input name="clientUri" value={app.uri} placeholder="Enter website" />
					</label>
					<label>
						Logo URL
						<input name="icon" value={app.icon || ''} placeholder="Enter logo" />
					</label>
					<label>
						Redirect URLs
						<textarea name="redirectUrls" rows="4" required>{app.redirectUrls}</textarea>
					</label>
					<p><strong>Status:</strong> {app.trusted ? 'trusted by Kevin' : 'not trusted by Kevin'}</p>
					<div class="button-row">
						<button>Save</button>
					</div>
				</form>
				<div class="form-stack">
					<p class="tiny"><strong>redirects:</strong> {app.redirectUrls || 'none'}</p>
					<p class="tiny"><strong>homepage:</strong> {app.uri || 'none'}</p>
					<p class="tiny"><strong>logo:</strong> {app.icon || 'none'}</p>
					<form method="post" action="?/deleteApp" use:enhance class="form-stack">
						<input type="hidden" name="clientId" value={app.clientId} />
						<button>Delete</button>
					</form>
				</div>
			</article>
		{:else}
			<p>No developer apps yet.</p>
		{/each}
	</div>
</div>
