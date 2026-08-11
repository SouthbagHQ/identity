<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { authClient } from '$lib/auth-client';
	import FaceCamera from '$lib/components/FaceCamera.svelte';
	import { renderQrSvg, toQrPayload } from '$lib/qr';
	import type { PageServerData } from './$types';

	let { data }: { data: PageServerData } = $props();

	let photo = $state<string | null>(null);
	let busy = $state(false);
	let message = $state('');

	const credential = $derived(data.credential.enrolled ? data.credential : null);
	const qrSvg = $derived(credential ? renderQrSvg(toQrPayload(credential.faceId)) : '');

	const formatDate = (value: string | Date | null | undefined) => {
		if (!value) return 'Not recorded';
		return new Intl.DateTimeFormat('en', {
			dateStyle: 'medium',
			timeStyle: 'short'
		}).format(new Date(value));
	};

	const enrol = async () => {
		if (!photo) {
			message = 'Take a photo first. That is the whole feature.';
			return;
		}

		busy = true;
		message = 'Sending your face to the face computer…';

		const { error } = await authClient.southbagId.enrol({ photo });

		busy = false;

		if (error) {
			message = error.message || 'The face computer rejected your face.';
			return;
		}

		photo = null;
		message = 'Face accepted.';

		await invalidateAll();
	};

	const deleteFace = async () => {
		busy = true;
		message = 'Deleting your face…';
		const { error } = await authClient.southbagId.forget();
		busy = false;
		if (error) {
			message = error.message || 'Could not delete your face.';
			return;
		}
		message = 'Your face has been deleted.';
		await invalidateAll();
	};

	const copyCode = async () => {
		if (!credential) return;
		await navigator.clipboard?.writeText(toQrPayload(credential.faceId)).catch(() => {});
		message = 'Code copied. Do not paste it at anyone.';
	};
</script>

<svelte:head>
	<title>Southbag Identity - Southbag ID™</title>
</svelte:head>

<header class="plain-header">
	<div>
		<h1>Southbag ID™</h1>
		<p>
			Southbag ID™ is the fastest, safest 🔒 and most personal way to prove that your face is
				your face 😀. Simply photograph your own head, let our award-winning 🏆 face computer estimate
				your date of birth, and receive a permanent QR code you can use to sign in from any device with
			a camera 📷, anywhere, forever, without ever remembering a password again ✨.
		</p>
	</div>
</header>

<div class="dashboard-grid">
	<div class="bad-card form-stack">
		{#if credential}
			<strong>Your enrolled face</strong>
			<p>If you want to replace your face, <a href="https://support.southbag.cc/ai">contact a human</a>.</p>
			<button type="button" onclick={deleteFace} disabled={busy}>
				{busy ? 'Deleting…' : 'Delete my face'}
			</button>
		{:else}
			<strong>Enrol your face</strong>
			<FaceCamera bind:photo {busy} captureLabel="Take photo" />
			<div class="button-row">
				<button type="button" class="btn-large" onclick={enrol} disabled={!photo || busy}>
					{busy ? 'Consulting the face computer…' : 'Enrol my face'}
				</button>
			</div>
		{/if}

		{#if message}
			<p class="bad-panel">{message}</p>
		{/if}
	</div>

	{#if credential}
		<div class="bad-card form-stack">
			<strong>Your recorded date of birth</strong>
			<label>
				Date of birth
				<input value={credential.dateOfBirth} readonly disabled />
			</label>
			<p class="tiny">
				This date was estimated from your photograph. Recorded {formatDate(credential.createdAt)}.
			</p>
		</div>
	{/if}
</div>

{#if credential}
	<div class="bad-panel">
		<strong>Your Southbag ID™ sign-in code</strong>
		<div class="qr-row">
			<div class="qr-holder">
				<!-- eslint-disable-next-line svelte/no-at-html-tags -->
				{@html qrSvg}
			</div>
			<div class="form-stack">
				<p class="tiny">Your id: {credential.faceId}</p>
				<div class="button-row">
					<button type="button" onclick={copyCode}>Copy code</button>
				</div>
			</div>
		</div>
	</div>
{/if}

<style>
	.qr-row {
		display: flex;
		flex-wrap: wrap;
		gap: 1rem;
		align-items: flex-start;
		margin-top: 0.75rem;
	}

	.qr-holder {
		width: min(260px, 70vw);
		border: 3px ridge #ccc;
		background: #fff;
		transform: none;
	}

	.qr-holder :global(svg) {
		display: block;
		width: 100%;
		height: auto;
	}
</style>
