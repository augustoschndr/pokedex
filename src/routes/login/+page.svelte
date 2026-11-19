<script lang="ts">
	import { goto } from '$app/navigation';
	import Art from '$lib/components/Art.svelte';
	import { signIn } from '$lib/passkey';

	let error = $state('');
	let busy = $state(false);

	async function enter() {
		error = '';
		busy = true;
		try {
			const next = await signIn();
			await goto(next);
		} catch (err) {
			error = err instanceof Error ? err.message : 'Passkey was not accepted';
		} finally {
			busy = false;
		}
	}
</script>

<svelte:head><title>Sign in · Pokedex</title></svelte:head>

<section class="step">
	<div class="step-main">
		<p class="kicker">Pokedex</p>
		<h1>Sign in</h1>
		<p class="lede">Use your passkey. Touch ID confirms it is you.</p>
		<Art name="passkey" />
		{#if error}<p class="error" role="alert">{error}</p>{/if}
	</div>
	<div class="step-footer stack">
		<button class="pill full" type="button" disabled={busy} onclick={enter}>
			{busy ? 'Waiting' : 'Continue'} <span aria-hidden="true">→</span>
		</button>
		<a class="text-btn" href="/setup" style="text-align:center">Use a setup code</a>
	</div>
</section>
