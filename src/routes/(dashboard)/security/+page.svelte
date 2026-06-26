<script lang="ts">
	import type { PageServerData } from './$types';

	let { data }: { data: PageServerData } = $props();

	let twoFactorPassword = $state('');
	let twoFactorCode = $state('');
	let twoFactorMessage = $state('');
	let twoFactorSetup = $state<{ totpURI: string; backupCodes?: string[] } | null>(null);

	type TwoFactorPayload = {
		message?: string;
		error?: { message?: string };
		totpURI?: string;
		backupCodes?: string[];
	};

	const formatDate = (value: string | null | undefined) => {
		if (!value) return 'Not recorded';
		return new Intl.DateTimeFormat('en', {
			dateStyle: 'medium',
			timeStyle: 'short'
		}).format(new Date(value));
	};

	const formatScopes = (value: string | null | undefined) =>
		(value ?? '')
			.split(/\s|,/)
			.map((scope) => scope.trim())
			.filter(Boolean)
			.join(', ');

	const postTwoFactor = async (path: string, body: Record<string, unknown>) => {
		twoFactorMessage = '';
		const response = await fetch(`/api/auth${path}`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(body)
		});
		const payload = (await response.json().catch(() => ({}))) as TwoFactorPayload;

		if (!response.ok) {
			throw new Error(payload?.message || payload?.error?.message || 'Two-factor request failed');
		}

		return payload;
	};

	const enableTwoFactor = async () => {
		try {
			const setup = await postTwoFactor('/two-factor/enable', {
				password: twoFactorPassword,
				issuer: 'Southbag Identity™'
			});
			if (!setup.totpURI) throw new Error('Two-factor setup did not return a TOTP URI');
			twoFactorSetup = {
				totpURI: setup.totpURI,
				backupCodes: setup.backupCodes
			};
			twoFactorMessage = 'Scan this, save the backup codes, then verify the current code.';
		} catch (error) {
			twoFactorMessage = error instanceof Error ? error.message : 'Two-factor setup failed';
		}
	};

	const verifyTwoFactor = async () => {
		try {
			await postTwoFactor('/two-factor/verify-totp', {
				code: twoFactorCode,
				trustDevice: true
			});
			twoFactorMessage = 'Two-factor authentication is enabled.';
			twoFactorSetup = null;
			twoFactorCode = '';
		} catch (error) {
			twoFactorMessage = error instanceof Error ? error.message : 'Verification failed';
		}
	};

	const disableTwoFactor = async () => {
		try {
			await postTwoFactor('/two-factor/disable', {
				password: twoFactorPassword
			});
			twoFactorMessage = 'Two-factor authentication is disabled.';
		} catch (error) {
			twoFactorMessage = error instanceof Error ? error.message : 'Could not disable two-factor authentication';
		}
	};
</script>

<svelte:head>
	<title>Southbag Identity - Security</title>
</svelte:head>

<header class="plain-header">
	<div>
		<h1>Security</h1>
		<p>Southbag cares about your security</p>
	</div>
</header>

<div class="dashboard-grid">
	<div class="bad-card form-stack">
		<strong>Two-factor authentication</strong>
		<p>{data.account.twoFactorEnabled ? 'Enabled' : 'Not enabled'}</p>
		<label>
			Password
			<input bind:value={twoFactorPassword} type="password" autocomplete="current-password" />
		</label>
		<div class="button-row">
			<button type="button" onclick={()=>alert("")}>Submit a security vulnerbility</button>
			<button type="button" onclick={enableTwoFactor}>Set up 2FA</button>
			<button type="button" onclick={disableTwoFactor}>Disable</button>
		</div>
		{#if twoFactorSetup}
			<label>
				TOTP URI
				<textarea readonly rows="4" value={twoFactorSetup.totpURI}></textarea>
			</label>
			{#if twoFactorSetup.backupCodes?.length}
				<div class="app-list">
					{#each twoFactorSetup.backupCodes as code}
						<p class="tiny">{code}</p>
					{/each}
				</div>
			{/if}
			<label>
				Authenticator code
				<input bind:value={twoFactorCode} inputmode="numeric" autocomplete="one-time-code" />
			</label>
			<button type="button" onclick={verifyTwoFactor}>Verify code</button>
		{/if}
		{#if twoFactorMessage}
			<p class="bad-panel">{twoFactorMessage}</p>
		{/if}
	</div>

	<div class="bad-card">
		<strong>Active sessions</strong>
		<div class="app-list">
			{#each data.sessions as session}
				<article class="app-row">
					<div>
						<strong>{session.current ? 'Current session' : 'Session'}</strong>
						<p class="tiny">{session.userAgent || 'Unknown device'}</p>
						<p class="tiny">{formatDate(session.updatedAt)}</p>
					</div>
				</article>
			{:else}
				<p>No active sessions recorded.</p>
			{/each}
		</div>
	</div>
</div>

<div class="bad-panel">
	<strong>Connected OAuth apps</strong>
	<div class="app-list">
		{#each data.authorizedApps as app}
			<article class="app-row">
				<div>
					<strong>{app.name || app.clientId}</strong>
					<p class="tiny">{formatScopes(app.scopes) || 'No scopes recorded'}</p>
					<p class="tiny">{formatDate(app.updatedAt)}</p>
				</div>
			</article>
		{:else}
			<p>No connected OAuth apps.</p>
		{/each}
	</div>
</div>
