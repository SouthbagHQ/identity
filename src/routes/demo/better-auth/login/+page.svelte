<script lang='ts'>
	import { enhance } from '$app/forms';
	import type { ActionData } from './$types';

	let { form }: { form: ActionData } = $props();
</script>

<h1>Login</h1>
<form method="post" action="?/signInEmail" use:enhance>
	<label>
		Email
		<input type="email" name="email" class="mt-1 px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-gray-500" />
	</label>
	<label>
		Password
		<input type="password" name="password" class="mt-1 px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-gray-500" />
	</label>
	<label>
		Name (for registration)
		<input name="name" class="mt-1 px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-gray-500" />
	</label>
	<button class="bg-gray-700 text-white px-4 py-2 rounded-md hover:bg-gray-800">Login</button>
	<button formaction="?/signUpEmail" class="bg-gray-700 text-white px-4 py-2 rounded-md hover:bg-gray-800">Register</button>
</form>
<p class="text-black">{form?.message ?? ''}</p>
