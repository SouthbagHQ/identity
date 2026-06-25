<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData, PageServerData } from './$types';

	let { data, form }: { data: PageServerData; form: ActionData } = $props();
</script>

<svelte:head>
	<title>Southbag Online Banking Dashboard</title>
	<meta
		name="description"
		content="Southbag online banking identity dashboard."
	/>
</svelte:head>

<main class="dashboard">
	<aside class="sidebar">
		<img class="logo-box" alt="Southbag Online Banking Logo" src="/logo.png" />
		<h2>Southbag Online Banking</h2>
		<a href="/">Account Access</a>
		<a href="/api/auth/.well-known/openid-configuration">OIDC Discovery</a>
		<a href="/api/auth/oauth2/register">Register Endpoint</a>
		<a href="/login">Login Page</a>
		<button type="button" onclick={() => alert('Backend says OK')}>Security</button>
		<button type="button" onclick={() => alert('Support unavailable')}>Support</button>
		<form method="post" action="?/signOut" use:enhance>
			<button>Sign out</button>
		</form>
	</aside>

	<section class="dashboard-main">
		<header class="plain-header">
			<div>
				<h1>Southbag Online Banking</h1>
				<p>Please manage your account.</p>
				<p>Logged in as {data.user?.email}</p>
			</div>
		</header>

		{#if form?.message}
			<p class="bad-panel">{form.message}</p>
		{/if}

		<div class="dashboard-grid">
			<form method="post" action="?/createApp" use:enhance class="bad-card form-stack">
				<strong>Create OIDC app</strong>
				<label>
					Application name
					<input name="name" placeholder="Enter app" required />
				</label>
				<label>
					Redirect URLs
					<textarea name="redirectUrls" rows="4" placeholder="Enter callback" required></textarea>
				</label>
				<label>
					Homepage URL
					<input name="clientUri" placeholder="Enter website" />
				</label>
				<label>
					Logo URL
					<input name="icon" placeholder="Enter logo" />
				</label>
				<div class="button-row">
					<button>Create</button>
					<button type="button" onclick={() => alert('Which app??')}>Confused?</button>
				</div>
			</form>

			<div class="bad-card">
				<strong>OIDC endpoints</strong>
				<p>Authorization endpoint:</p>
				<p class="tiny">{data.origin}/api/auth/oauth2/authorize</p>
				<p>Token endpoint:</p>
				<p class="tiny">{data.origin}/api/auth/oauth2/token</p>
				<p>Scopes:</p>
				<p class="tiny">openid profile email money accounts transfer_everything offline_access</p>
			</div>
		</div>

		<div class="bad-panel">
			<strong>Apps</strong>
			<div class="app-list">
				{#each data.apps as app}
					<article class="app-row">
						<div>
							<strong>{app.name || 'No Name App'}</strong>
							<p class="tiny"><strong>client_id:</strong> {app.clientId}</p>
							<p class="tiny"><strong>client_secret:</strong> {app.clientSecret || 'not shown'}</p>
							<p class="tiny"><strong>redirects:</strong> {app.redirectUrls}</p>
							<p><strong>Status:</strong> {app.trusted ? 'trusted' : 'untrusted, 20 dialogues'}</p>
							<p class="tiny">{app.memo}</p>
						</div>
						<form method="post" action="?/setTrust" use:enhance class="form-stack">
							<input type="hidden" name="clientId" value={app.clientId} />
							<button name="trusted" value="true">Trust</button>
							<button name="trusted" value="false">Untrust</button>
							<button formaction="?/deleteApp">Delete</button>
						</form>
					</article>
				{:else}
					<p>No apps yet.</p>
				{/each}
			</div>
		</div>
	</section>
</main>
