<script lang="ts">
	import jsQR from 'jsqr';
	import { fromQrPayload } from '$lib/qr';

	type Props = {
		faceId?: string;
		busy?: boolean;
	};

	let { faceId = $bindable(''), busy = false }: Props = $props();

	let videoEl = $state<HTMLVideoElement | null>(null);
	let stream = $state<MediaStream | null>(null);
	let cameraError = $state('');
	let starting = $state(false);
	let manualEntry = $state('');
	let frame = 0;

	const canvas =
		typeof document === 'undefined' ? null : document.createElement('canvas');

	const stopCamera = () => {
		if (frame) cancelAnimationFrame(frame);
		frame = 0;
		stream?.getTracks().forEach((track) => track.stop());
		stream = null;
		if (videoEl) videoEl.srcObject = null;
	};

	const scanFrame = () => {
		frame = requestAnimationFrame(scanFrame);
		if (!videoEl || !canvas) return;

		const width = videoEl.videoWidth;
		const height = videoEl.videoHeight;
		if (!width || !height) return;

		canvas.width = width;
		canvas.height = height;
		const context = canvas.getContext('2d', { willReadFrequently: true });
		if (!context) return;

		context.drawImage(videoEl, 0, 0, width, height);
		const found = jsQR(context.getImageData(0, 0, width, height).data, width, height, {
			inversionAttempts: 'dontInvert'
		});

		if (found?.data) {
			const parsed = fromQrPayload(found.data);
			if (parsed) {
				faceId = parsed;
				stopCamera();
			}
		}
	};

	const startCamera = async () => {
		cameraError = '';
		starting = true;
		try {
			if (!navigator.mediaDevices?.getUserMedia) {
				throw new Error('No camera here. Type the code in by hand like it is 1998.');
			}
			const media = await navigator.mediaDevices.getUserMedia({
				video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
				audio: false
			});
			stream = media;
			if (videoEl) {
				videoEl.srcObject = media;
				await videoEl.play().catch(() => {});
			}
			frame = requestAnimationFrame(scanFrame);
		} catch (error) {
			cameraError = error instanceof Error ? error.message : 'The camera said no.';
		} finally {
			starting = false;
		}
	};

	const useManualEntry = () => {
		const parsed = fromQrPayload(manualEntry);
		if (!parsed) {
			cameraError = 'That is not a Southbag ID™ code.';
			return;
		}
		cameraError = '';
		faceId = parsed;
		stopCamera();
	};

	$effect(() => () => stopCamera());
</script>

<div class="qr-scanner">
	{#if faceId}
		<p class="tiny">Southbag ID™ code accepted: <strong>{faceId}</strong></p>
		<div class="button-row">
			<button type="button" onclick={() => (faceId = '')} disabled={busy}>Scan a different code</button>
		</div>
	{:else}
		<p class="tiny">Hold your Southbag ID™ QR code up to the camera. Any camera. Preferably yours.</p>

		<!-- svelte-ignore a11y_media_has_caption -->
		<video class="qr-feed" bind:this={videoEl} playsinline muted autoplay hidden={!stream}></video>

		{#if !stream}
			<div class="qr-placeholder" aria-hidden="true">NO QR CODE DETECTED YET</div>
		{/if}

		<div class="button-row">
			{#if stream}
				<button type="button" onclick={stopCamera} disabled={busy}>Stop scanning</button>
			{:else}
				<button type="button" class="btn-large" onclick={startCamera} disabled={starting || busy}>
					{starting ? 'Waking the camera…' : 'Scan QR code'}
				</button>
			{/if}
		</div>

		<label>
			Or type the code from under the QR code
			<input bind:value={manualEntry} placeholder="southbag-id:…" disabled={busy} />
		</label>
		<div class="button-row">
			<button type="button" onclick={useManualEntry} disabled={busy}>Use typed code</button>
		</div>
	{/if}

	{#if cameraError}
		<p class="bad-panel tiny">{cameraError}</p>
	{/if}
</div>

<style>
	.qr-scanner {
		display: grid;
		gap: 0.5rem;
	}

	.qr-feed,
	.qr-placeholder {
		width: 100%;
		max-width: 340px;
		border: 3px ridge #ccc;
		background: #f2f2f2;
		transform: rotate(1deg);
	}

	.qr-placeholder {
		display: grid;
		place-items: center;
		min-height: 180px;
		font-size: 0.9rem;
	}
</style>
