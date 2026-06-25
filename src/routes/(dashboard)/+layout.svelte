<script lang="ts">
	import { page } from '$app/state';
	import { enhance } from '$app/forms';
	import type { LayoutData } from './$types';

	let { data, children }: { data: LayoutData; children: import('svelte').Snippet } = $props();

	const links = [
		{ href: '/home', label: 'Home' },
		{ href: '/account', label: 'Account' },
		{ href: '/security', label: 'Security' },
		{ href: '/developer', label: 'Developer' }
	];

	const isActive = (href: string) => page.url.pathname === href || page.url.pathname.startsWith(`${href}/`);
</script>

<main class="dashboard">
	<aside class="sidebar">
		<img class="logo-box" alt="Southbag Online Banking Logo" src="/logo.png" />
		<h2>Southbag Online Banking</h2>
		<p class="tiny">Logged in as {data.user.email}</p>
		{#each links as link}
			<a class:active={isActive(link.href)} href={link.href}>{link.label}</a>
		{/each}
		<a href="/api/auth/.well-known/openid-configuration">OIDC Discovery</a>
		<a href="/login">Login Page</a>
		<form method="post" action="/home?/signOut" use:enhance>
			<button>Sign out</button>
		</form>
	</aside>

	<section class="dashboard-main">
		{@render children()}
	</section>
</main>
