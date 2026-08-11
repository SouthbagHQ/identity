<script lang="ts">
	import { authClient } from '$lib/auth-client';
	import FaceCamera from './FaceCamera.svelte';
	import QrScanner from './QrScanner.svelte';

	type Props = {
		callbackURL?: string;
	};

	let { callbackURL = '/home' }: Props = $props();

	let open = $state(false);
	let faceId = $state('');
	let photo = $state<string | null>(null);
	let busy = $state(false);
	let message = $state('');

	const reset = () => {
		faceId = '';
		photo = null;
		message = '';
	};

	const signIn = async () => {
		if (!faceId || !photo) return;

		busy = true;
		message = 'Comparing your face with the face on file…';

		const { data, error } = await authClient.signIn.southbagId({ faceId, photo });

		busy = false;

		if (error) {
			message = error.message || 'The face computer says you are not you.';
			photo = null;
			return;
		}

		message = `Face accepted${data?.notes ? `: “${data.notes}”` : ''}. Letting you in…`;
		window.location.href = callbackURL;
	};
</script>

<section class="southbag-id-login">
	<div class="button-row">
		<button
			type="button"
			class="btn-large"
			onclick={() => {
				open = !open;
				if (!open) reset();
			}}
		>
			{open ? 'Hide Southbag ID™' : 'Sign in with Southbag ID™ (your face)'}
		</button>
	</div>

	{#if open}
		<div class="bad-panel form-stack">
			<strong>Step 1 — scan your Southbag ID™ QR code</strong>
			<QrScanner bind:faceId {busy} />

			{#if faceId}
				<strong>Step 2 — show us the face that goes with it</strong>
				<FaceCamera
					bind:photo
					{busy}
					captureLabel="Take photo for sign in"
					hint="Look directly into the camera and think about banking."
				/>

				<div class="button-row">
					<button type="button" class="btn-large" onclick={signIn} disabled={!photo || busy}>
						{busy ? 'Checking your face…' : 'Sign in with this face'}
					</button>
					<button type="button" onclick={reset} disabled={busy}>Start over</button>
				</div>
			{/if}

			{#if message}
				<p class="bad-panel">{message}</p>
			{/if}

		</div>
	{/if}
</section>

<style>
	.southbag-id-login {
		display: grid;
		gap: 0.5rem;
		margin: 0.75rem 0;
	}
</style>
