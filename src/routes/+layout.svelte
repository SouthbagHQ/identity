<script lang="ts">
	import './layout.css';

	let { data, children } = $props();

	// palantir.js settles the identity on page load; this only follows changes that happen
	// during client-side navigation without a reload (e.g. a session expiring mid-visit).
	let knownUserId: string | null | undefined = undefined;
	$effect(() => {
		const id = data.user?.id ?? null;
		if (knownUserId === undefined) {
			knownUserId = id;
			return;
		}
		if (id === knownUserId) return;
		knownUserId = id;
		if (data.user) window.palantir?.identify(data.user);
		else window.palantir?.reset();
	});
</script>

<svelte:head>
	<link rel="icon" href="/logo.png" type="image/png" />
	<script
		src="/palantir.js"
		data-app="identity"
		data-user-id={data.user?.id}
		data-user-email={data.user?.email}
		data-user-name={data.user?.name}
	></script>
</svelte:head>
<div class="southbag-shell">
	{@render children()}
</div>
