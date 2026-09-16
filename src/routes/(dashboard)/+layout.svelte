<script lang="ts">
	import { page } from '$app/state';
	import { enhance } from '$app/forms';
	import type { LayoutData } from './$types';
    import { authClient } from '$lib/auth-client';
    import { goto } from '$app/navigation';
	import { track } from '$lib/palantir';

	let { data, children }: { data: LayoutData; children: import('svelte').Snippet } = $props();

	const links = [
		{ href: '/home', label: 'Home' },
		{ href: '/account', label: 'Account' },
		{ href: '/security', label: 'Security' },
		{ href: '/southbag-id', label: 'Southbag ID™' },
		{ href: '/developer', label: 'Developer' }
	];

	const isActive = (href: string) => page.url.pathname === href || page.url.pathname.startsWith(`${href}/`);
</script>

<main class="dashboard">
	<aside class="sidebar">
		<img class="w-[120%] min-w-[120%]" alt="Southbag Identity™ Logo" src="/logo.png" />
		<h2>Southbag Identity™</h2>
		<p class="tiny">Hello, "{data.user.email}" !</p>
		{#each links as link}
			<a class:active={isActive(link.href)} href={link.href} onclick={() => track('sidebar_link_clicked', { label: link.label, href: link.href })}>{link.label}</a>
		{/each}
		<a href="/login" onclick={() => track('sidebar_link_clicked', { label: 'Login Page', href: '/login' })}>Login Page</a>
		<form method="post" action="/home?/signOut" use:enhance={() => { track('sign_out_clicked'); }}>
			<button>Sign out</button>
		</form>
		<button onclick={async ()=> {
		  track('delete_account_clicked');
		  const {error}=await authClient.deleteUser();
				if (!error) {
				window.palantir?.reset();
				goto("/deleted")
				} else {
				track('delete_account_failed', { error_message: error.message });
				}
		}}>Delete account</button>
	</aside>

	<section class="dashboard-main">
		{@render children()}
	</section>
	<footer>Kevin is watching</footer>
</main>
