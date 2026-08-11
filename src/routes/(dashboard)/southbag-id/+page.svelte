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
	let notes = $state('');

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
		notes = '';

		const { data: result, error } = await authClient.southbagId.enrol({ photo });

		busy = false;

		if (error) {
			message = error.message || 'The face computer rejected your face.';
			return;
		}

		photo = null;
		notes = result?.notes ?? '';
		message = result?.age === result?.estimatedAge
			? `Face accepted. Your age is ${result?.age} and that is final.`
			: `Face updated. Your age stays at ${result?.age} (the face computer guessed ${result?.estimatedAge} this time, but ages are not editable).`;

		await invalidateAll();
	};

	const forget = async () => {
		busy = true;
		message = 'Removing your face…';
		await authClient.southbagId.forget();
		busy = false;
		photo = null;
		notes = '';
		message = 'Your face has been removed. Your age went with it.';
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
			how old you are, and receive a permanent QR code you can use to sign in from any device with
			a camera 📷, anywhere, forever, without ever remembering a password again ✨.
		</p>
	</div>
</header>

<div class="dashboard-grid">
	<div class="bad-card form-stack">
		<strong>{credential ? 'Replace your enrolled face' : 'Enrol your face'}</strong>

		<FaceCamera bind:photo {busy} captureLabel={credential ? 'Take replacement photo' : 'Take photo'} />

		<div class="button-row">
			<button type="button" class="btn-large" onclick={enrol} disabled={!photo || busy}>
				{busy ? 'Consulting the face computer…' : credential ? 'Replace my face' : 'Enrol my face'}
			</button>
			{#if credential}
				<button type="button" onclick={forget} disabled={busy}>Forget my face</button>
			{/if}
		</div>

		{#if message}
			<p class="bad-panel">{message}</p>
		{/if}
		{#if notes}
			<p class="tiny">Face computer remarks: “{notes}”</p>
		{/if}
	</div>

	{#if credential}
		<div class="bad-card form-stack">
			<strong>Your recorded age</strong>
			<label>
				Age (permanent)
				<input value={credential.age} readonly disabled />
			</label>
			<p class="tiny">
				This number was decided by a photograph and cannot be changed by you, us, or the passage of
				time. Recorded {formatDate(credential.createdAt)}.
			</p>
			{#if credential.verdict}
				<p class="tiny">Original verdict: “{credential.verdict}”</p>
			{/if}
		</div>
	{/if}
</div>

{#if credential}
	<div class="bad-panel">
		<strong>Your Southbag ID™ sign-in code</strong>
		<p class="tiny">
			Present this QR code to the “Sign in with Southbag ID™” button on the login page, then show it
			your face. Screenshot it, print it, laminate it, tattoo it.
		</p>
		<div class="qr-row">
			<div class="qr-holder">
				<!-- eslint-disable-next-line svelte/no-at-html-tags -->
				{@html qrSvg}
			</div>
			<div class="form-stack">
				<img class="face-on-file" alt="You, as held on file by Southbag" src={credential.photo} />
				<p class="tiny">Face id: {credential.faceId}</p>
				<p class="tiny">Last updated {formatDate(credential.updatedAt)}</p>
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
		transform: rotate(-1deg);
	}

	.qr-holder :global(svg) {
		display: block;
		width: 100%;
		height: auto;
	}

	.face-on-file {
		width: 140px;
		border: 3px ridge #ccc;
		transform: rotate(2deg);
	}
</style>
