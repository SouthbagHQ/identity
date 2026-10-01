<script lang="ts">
	import type { PageServerData } from './$types';
	import { invalidateAll } from '$app/navigation';
	import { track } from '$lib/palantir';

	let { data }: { data: PageServerData } = $props();

	let twoFactorPassword = $state('');
	let twoFactorCode = $state('');
	let twoFactorMessage = $state('');
	let twoFactorSetup = $state<{ totpURI: string; backupCodes?: string[] } | null>(null);

	let currentPassword = $state('');
	let newPassword = $state('');
	let confirmPassword = $state('');
	let revokeOtherSessions = $state(true);
	let passwordMessage = $state('');
	let changingPassword = $state(false);

	const hasPassword = $derived(data.account.providers.some((provider) => provider.hasPassword));

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
		track('two_factor_setup_started');
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
			track('two_factor_qr_shown', { backup_codes: setup.backupCodes?.length ?? 0 });
		} catch (error) {
			twoFactorMessage = error instanceof Error ? error.message : 'Two-factor setup failed';
			track('two_factor_setup_failed', { error_message: twoFactorMessage });
		}
	};

	const verifyTwoFactor = async () => {
		track('two_factor_verify_clicked');
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

	const changePassword = async () => {
		track('change_password_clicked');
		passwordMessage = '';
		if (newPassword !== confirmPassword) {
			passwordMessage = 'New passwords do not match.';
			return;
		}

		changingPassword = true;
		try {
			const response = await fetch('/api/auth/change-password', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ currentPassword, newPassword, revokeOtherSessions })
			});
			const payload = (await response.json().catch(() => ({}))) as TwoFactorPayload;

			if (!response.ok) {
				throw new Error(payload?.message || payload?.error?.message || 'Could not change password');
			}

			currentPassword = '';
			newPassword = '';
			confirmPassword = '';
			passwordMessage = 'Password changed.';
			await invalidateAll();
		} catch (error) {
			passwordMessage = error instanceof Error ? error.message : 'Could not change password';
			track('change_password_failed', { error_message: passwordMessage });
		} finally {
			changingPassword = false;
		}
	};

	const disableTwoFactor = async () => {
		track('two_factor_disable_clicked');
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
		<p>Southbag helps protect your account 🔐 with modern security controls, simple two-factor authentication, and clear sign-in settings designed to keep your identity, access, and personal information safer every time you use Southbag ✨, whether you are checking your profile, managing connected apps, or signing in from a new device 🛡️.</p>
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
			<button type="button" onclick={()=>{ track('security_bounty_clicked'); alert(""); }}>Submit a security vulnerbility</button>
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

	<form
		class="bad-card form-stack"
		onsubmit={(event) => {
			event.preventDefault();
			changePassword();
		}}
	>
		<strong>Change password</strong>
		{#if hasPassword}
			<label>
				Current password
				<input bind:value={currentPassword} type="password" autocomplete="current-password" required />
			</label>
			<label>
				New password
				<input bind:value={newPassword} type="password" autocomplete="new-password" minlength="8" required />
			</label>
			<label>
				Confirm new password
				<input bind:value={confirmPassword} type="password" autocomplete="new-password" minlength="8" required />
			</label>
			<label>
				<input bind:checked={revokeOtherSessions} type="checkbox" />
				Sign out other sessions
			</label>
			<div class="button-row">
				<button type="submit" disabled={changingPassword}>
					{changingPassword ? 'Changing…' : 'Change password'}
				</button>
			</div>
		{:else}
			<p>This account signs in without a password, so there is nothing to change.</p>
		{/if}
		{#if passwordMessage}
			<p class="bad-panel">{passwordMessage}</p>
		{/if}
	</form>

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
	<strong>Connected apps</strong>
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
			<p>No connected apps.</p>
		{/each}
	</div>
</div>
