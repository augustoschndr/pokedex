<script lang="ts">
	import { goto } from '$app/navigation';
	import Art from '$lib/components/Art.svelte';
	import { createPasskey } from '$lib/passkey';

	let { data, form } = $props();
	let error = $state('');
	let busy = $state(false);

	async function passkey() {
		error = '';
		busy = true;
		try {
			const next = await createPasskey();
			await goto(next);
		} catch (err) {
			error = err instanceof Error ? err.message : 'Passkey was not created. Try again';
		} finally {
			busy = false;
		}
	}
</script>

<svelte:head><title>Pokedex</title></svelte:head>

<section class="step">
	{#if data.step === 'welcome'}
		<div class="step-main">
			<p class="kicker">Welcome to</p>
			<h1 class="wordmark">Pokedex</h1>
			<p class="lede">The lesson to film, the week's shots, and the decisions only you answer.</p>
			<Art name="welcome" />
		</div>
		<div class="step-footer">
			<a class="pill full" href="/setup?step=code">Get started <span aria-hidden="true">→</span></a>
		</div>
	{:else if data.step === 'code'}
		<form method="POST" action="?/code" class="step-main">
			<p class="kicker">First</p>
			<h1>Enter the setup code</h1>
			<p class="lede">It is printed once in the server log when Pokedex starts.</p>
			<label class="sr" for="code" style="position:absolute;width:1px;height:1px;overflow:hidden">Setup code</label>
			<input
				id="code"
				name="code"
				class="field"
				style="margin-top: 24px"
				autocomplete="one-time-code"
				autocapitalize="characters"
				spellcheck="false"
				inputmode="text"
				maxlength="11"
				required
			/>
			{#if form?.error}<p class="error" role="alert">{form.error}</p>{/if}
			<div class="step-footer" style="margin-top: auto">
				<a class="text-btn" href="/setup">Back</a>
				<button class="pill" type="submit">Next <span aria-hidden="true">→</span></button>
			</div>
		</form>
	{:else}
		<div class="step-main">
			<p class="kicker">{data.hasPasskey ? 'Another device' : 'Only you'}</p>
			<h1>{data.hasPasskey ? 'Add a passkey' : 'Create your passkey'}</h1>
			<p class="lede">Touch ID confirms it is you. The passkey stays on this iPhone.</p>
			<Art name="passkey" />
			{#if error}<p class="error" role="alert">{error}</p>{/if}
		</div>
		<div class="step-footer">
			<a class="text-btn" href="/setup?step=code">Back</a>
			<button class="pill" type="button" disabled={busy} onclick={passkey}>
				{busy ? 'Waiting' : 'Create passkey'} <span aria-hidden="true">→</span>
			</button>
		</div>
	{/if}
</section>
