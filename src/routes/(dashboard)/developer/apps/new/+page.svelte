<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData, PageServerData } from './$types';

	let { data, form }: { data: PageServerData; form: ActionData } = $props();
</script>

<svelte:head>
	<title>Southbag Identity - New OAuth App</title>
</svelte:head>

<header class="plain-header">
	<div>
		<h1>New OAuth app</h1>
		<p>Create a developer app. It will not be trusted by users.</p>
	</div>
</header>

{#if form?.message}
	<p class="bad-panel">{form.message}</p>
{/if}

<div class="dashboard-grid">
	<form method="post" action="?/createApp" use:enhance class="bad-card form-stack">
		<strong>Create OAuth app</strong>
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
			<a class="button-link" href="/developer">Cancel</a>
		</div>
	</form>

	<div class="bad-card">
		<strong>OAuth/OIDC endpoints</strong>
		<p>Authorization endpoint:</p>
		<p class="tiny">{data.origin}/api/auth/oauth2/authorize</p>
		<p>Token endpoint:</p>
		<p class="tiny">{data.origin}/api/auth/oauth2/token</p>
		<p>Trust:</p>
		<p class="tiny">New apps are untrusted unless Southbag changes that server-side.</p>
	</div>
</div>
