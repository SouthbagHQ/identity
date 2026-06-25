<script lang="ts">
	import './layout.css';

	let { children } = $props();
</script>

<svelte:head><link rel="icon" href="/logo.png" type="image/png" /></svelte:head>
<div class="southbag-shell">
	{@render children()}
</div>
