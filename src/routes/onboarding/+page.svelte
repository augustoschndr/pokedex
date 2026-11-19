<script lang="ts">
	import { goto } from '$app/navigation';
	import Art from '$lib/components/Art.svelte';
	import { enablePush, isStandalone } from '$lib/push';

	let { data } = $props();
	const step = $derived(data.step);
	let message = $state('');
	let busy = $state(false);

	async function notes() {
		message = '';
		busy = true;
		try {
			if (!isStandalone()) {
				message = 'Add Pokedex to the Home Screen first. You can turn notifications on after that.';
				await goto('/onboarding?step=home');
				return;
			}
			const result = await enablePush(data.vapidPublicKey);
			message = result.message;
			await goto('/onboarding?step=home');
		} catch {
			message = 'Notifications stay off for now';
			await goto('/onboarding?step=home');
		} finally {
			busy = false;
		}
	}

	async function finish() {
		await fetch('/api/v1/me/onboarding', { method: 'POST' });
		await goto('/today');
	}
</script>

<svelte:head><title>Set up · Pokedex</title></svelte:head>

<section class="step">
	{#if step === 'notes'}
		<div class="step-main">
			<p class="kicker">Step 2</p>
			<h1>Notes, not noise</h1>
			<p class="lede">A short push when a brief arrives. On this iPhone that works after Pokedex is on your Home Screen.</p>
			<Art name="bell" />
			{#if message}<p class="meta">{message}</p>{/if}
		</div>
		<div class="step-footer stack">
			<button class="pill full" type="button" disabled={busy} onclick={notes}>
				Enable notifications <span aria-hidden="true">→</span>
			</button>
			<a class="text-btn" href="/onboarding?step=home" style="text-align:center">Not now</a>
		</div>
	{:else}
		<div class="step-main">
			<p class="kicker">Last step</p>
			<h1>Add to Home Screen</h1>
			<p class="lede">In Safari, tap Share at the bottom of the screen, then Add to Home Screen. Open Pokedex from the icon after that.</p>
			<Art name="home" />
		</div>
		<div class="step-footer stack">
			<button class="pill full" type="button" onclick={finish}>
				I added it <span aria-hidden="true">→</span>
			</button>
			<button class="text-btn" type="button" onclick={finish}>I will do this later</button>
		</div>
	{/if}
</section>
