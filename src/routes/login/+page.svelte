<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData } from './$types';

	let { form }: { form: ActionData } = $props();
</script>

<svelte:head>
	<title>Southbag Online Banking - Secure Login & Account Access</title>
</svelte:head>

<main class="login-page">
	<header class="plain-header">
		<img class="logo-box" alt="Southbag Online Banking Logo" src="/logo.png" />
		<h2>Southbag Online Banking</h2>
	</header>

	<h1>Welcome to Southbag Online Banking</h1>
	<p>Please log in to access your account.</p>
	<div class="bank-image" aria-hidden="true">
		<img alt="" src="/logo.png" />
		<span>BANK</span>
	</div>

	<form method="post" action="?/signInEmail" use:enhance class="login-form">
		<div>
			<p>email</p>
			<input type="email" name="email" placeholder="Enter email" required />
			<button type="button" class="btn-small" onclick={() => alert('Use the email box')}>Confused?</button>
		</div>
		<div>
			<p>password</p>
			<input type="text" name="password" placeholder="Enter username" required />
		</div>
		<button type="button" class="btn-large" onclick={() => alert('Forgot Password? Chat Now')}>Forgot Password? Chat Now</button>
		<div>
			<p>username</p>
			<input name="username" placeholder="Enter password" />
		</div>
		<button type="button" class="btn-small" onclick={() => alert('A username is an amount')}>What's a username?</button>
		<div>
			<p>full name</p>
			<input name="name" placeholder="Enter Name" />
		</div>
		<div>
			<p>amount</p>
			<input name="amount" placeholder="Enter Amount" />
		</div>
		<button type="button" class="btn-large" onclick={() => alert('How much should I enter?')}>How much should I enter?</button>
		<div>
			<p>number</p>
			<input name="number" placeholder="Enter Number" />
			<button type="button" class="btn-small" onclick={() => alert('Which number??')}>Which number??</button>
		</div>
		<div>
			<p>name</p>
			<input name="extraName" placeholder="Enter Name" />
		</div>
		<div>
			<p>code</p>
			<input name="code" placeholder="Enter Code" />
		</div>
		<button type="button" class="btn-large" onclick={() => alert('I do not have a code either')}>I don't have a code</button>
		<div>
			<p>6 Digit code</p>
			<input name="sixDigitCode" placeholder="6 Digit code" />
		</div>
		<div>
			<p>Balance?</p>
			<input name="balance" placeholder="Yes" />
		</div>
		<div class="button-row">
			<button>Submit</button>
			<button formaction="?/signUpEmail">Register</button>
			<button type="button" class="btn-large" onclick={() => alert('Chat with a Human')}>Chat with a Human</button>
		</div>
	</form>

	{#if form?.message}
		<p>{form.message}</p>
	{/if}

	<footer class="login-footer">
		<button type="button" class="btn-large" onclick={() => document.body.classList.toggle('dark-mode')}>Dark Mode</button>
		<button type="button">Security Bounty</button>
		<button type="button" class="btn-large">Find a Branch</button>
		<button type="button">Locate Store</button>
		<button type="button" class="btn-large">Branch Locations</button>
		<button type="button" class="btn-large">Chat with a Human</button>
		<button type="button">Live Support</button>
		<button type="button" class="btn-large">Contact Us</button>
		<button type="button">Get Help Now</button>
		<button type="button" class="btn-large">Speak to an Agent</button>
		<button type="button">Customer Service</button>
	</footer>
</main>
