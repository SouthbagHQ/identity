<script lang="ts">
	type Props = {
		photo?: string | null;
		hint?: string;
		captureLabel?: string;
		busy?: boolean;
	};

	let {
		photo = $bindable<string | null>(null),
		hint = 'Put your face inside the rectangle. Do not put anyone else in there.',
		captureLabel = 'Take photo',
		busy = false
	}: Props = $props();

	/** Faces are stored in a database, so they get shrunk first. */
	const MAX_EDGE = 512;

	let videoEl = $state<HTMLVideoElement | null>(null);
	let stream = $state<MediaStream | null>(null);
	let cameraError = $state('');
	let starting = $state(false);

	const stopCamera = () => {
		stream?.getTracks().forEach((track) => track.stop());
		stream = null;
		if (videoEl) videoEl.srcObject = null;
	};

	const startCamera = async () => {
		cameraError = '';
		starting = true;
		try {
			if (!navigator.mediaDevices?.getUserMedia) {
				throw new Error('This browser has no camera. Please obtain a browser with a camera.');
			}
			const media = await navigator.mediaDevices.getUserMedia({
				video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
				audio: false
			});
			stream = media;
			if (videoEl) {
				videoEl.srcObject = media;
				await videoEl.play().catch(() => {});
			}
		} catch (error) {
			cameraError = error instanceof Error ? error.message : 'The camera said no.';
		} finally {
			starting = false;
		}
	};

	const capture = () => {
		if (!videoEl) return;
		const width = videoEl.videoWidth;
		const height = videoEl.videoHeight;
		if (!width || !height) {
			cameraError = 'The camera is still waking up. Try again in a moment.';
			return;
		}

		const scale = Math.min(1, MAX_EDGE / Math.max(width, height));
		const canvas = document.createElement('canvas');
		canvas.width = Math.round(width * scale);
		canvas.height = Math.round(height * scale);

		const context = canvas.getContext('2d');
		if (!context) {
			cameraError = 'Could not draw your face onto a canvas.';
			return;
		}

		context.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
		photo = canvas.toDataURL('image/jpeg', 0.75);
		stopCamera();
	};

	const retake = async () => {
		photo = null;
		await startCamera();
	};

	$effect(() => () => stopCamera());
</script>

<div class="face-camera">
	<p class="tiny">{hint}</p>

	{#if photo}
		<img class="face-shot" alt="You, as captured a moment ago" src={photo} />
		<div class="button-row">
			<button type="button" onclick={retake} disabled={busy}>Retake photo</button>
		</div>
	{:else}
		<!-- svelte-ignore a11y_media_has_caption -->
		<video
			class="face-feed"
			bind:this={videoEl}
			playsinline
			muted
			autoplay
			hidden={!stream}
		></video>

		{#if !stream}
			<div class="face-placeholder" aria-hidden="true">NO FACE DETECTED YET</div>
		{/if}

		<div class="button-row">
			{#if stream}
				<button type="button" class="btn-large" onclick={capture} disabled={busy}>
					{captureLabel}
				</button>
				<button type="button" onclick={stopCamera} disabled={busy}>Turn camera off</button>
			{:else}
				<button type="button" class="btn-large" onclick={startCamera} disabled={starting || busy}>
					{starting ? 'Waking the camera…' : 'Turn camera on'}
				</button>
			{/if}
		</div>
	{/if}

	{#if cameraError}
		<p class="bad-panel tiny">{cameraError}</p>
	{/if}
</div>

<style>
	.face-camera {
		display: grid;
		gap: 0.5rem;
	}

	.face-feed,
	.face-shot {
		width: 100%;
		max-width: 340px;
		border: 3px ridge #ccc;
		background: #f2f2f2;
		transform: rotate(-1deg);
	}

	.face-placeholder {
		display: grid;
		place-items: center;
		width: 100%;
		max-width: 340px;
		min-height: 180px;
		border: 3px ridge #ccc;
		background: #f2f2f2;
		transform: rotate(-1deg);
		font-size: 0.9rem;
	}
</style>
