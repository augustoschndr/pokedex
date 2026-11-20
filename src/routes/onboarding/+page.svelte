<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import Art from '$lib/components/Art.svelte';
	import HomeGuide from '$lib/components/HomeGuide.svelte';
	import {
		detectInstallClient,
		homeScreenCopy,
		listenForInstallPrompt,
		notificationCopy,
		runInstallPrompt,
		type BeforeInstallPromptEvent,
		type InstallClient
	} from '$lib/install';
	import { enablePush } from '$lib/push';

	let { data } = $props();
	let client = $state<InstallClient | null>(null);
	let promptEvent = $state<BeforeInstallPromptEvent | null>(null);
	let mode = $state<'home' | 'install' | 'notes'>('home');
	let message = $state('');
	let busy = $state(false);
	const guide = $derived(client ? homeScreenCopy(client) : null);
	const notesCopy = $derived(client ? notificationCopy(client) : '');

	onMount(() => {
		const detected = detectInstallClient();
		client = detected;
		if (detected.standalone) mode = 'notes';
		else if (detected.ios) mode = 'home';
		else mode = 'install';
		const stop = listenForInstallPrompt((event) => {
			promptEvent = event;
		});
		const onInstalled = () => {
			promptEvent = null;
			mode = 'notes';
		};
		window.addEventListener('appinstalled', onInstalled);
		return () => {
			stop();
			window.removeEventListener('appinstalled', onInstalled);
		};
	});

	async function finish() {
		await fetch('/api/v1/me/onboarding', { method: 'POST' });
		await goto('/today');
	}

	function acknowledge() {
		message = 'Open the Pokedex icon on your Home Screen. Notifications are the next step there.';
	}

	async function install() {
		if (!promptEvent) return;
		message = '';
		busy = true;
		try {
			const outcome = await runInstallPrompt(promptEvent);
			promptEvent = null;
			if (outcome === 'accepted') mode = 'notes';
			else message = 'You can install from the browser menu later.';
		} catch {
			message = 'Install did not finish';
		} finally {
			busy = false;
		}
	}

	async function notes() {
		if (!client) return;
		message = '';
		busy = true;
		try {
			const result = await enablePush(data.vapidPublicKey);
			message = result.message;
			if (result.ok) await finish();
		} catch {
			message = 'Notifications stay off for now';
		} finally {
			busy = false;
		}
	}
</script>

<svelte:head><title>Set up · Pokedex</title></svelte:head>

<section class="step" data-mode={client ? mode : 'pending'} data-surface={client?.surface ?? 'pending'}>
	{#if !client}
		<div class="step-main"></div>
	{:else if mode === 'notes'}
		<div class="step-main">
			<p class="kicker">Last step</p>
			<h1>Notes, not noise</h1>
			<p class="lede">{notesCopy}</p>
			<Art name="bell" />
			{#if message}<p class="meta">{message}</p>{/if}
		</div>
		<div class="step-footer stack">
			{#if client.ios && !client.standalone}
				<p class="meta">Open Pokedex from the Home Screen icon to turn notifications on.</p>
				<button class="pill full" type="button" onclick={() => (mode = 'home')}>Show the steps</button>
			{:else}
				<button class="pill full" type="button" disabled={busy} onclick={notes}>
					Enable notifications <span aria-hidden="true">→</span>
				</button>
			{/if}
			<button class="text-btn" type="button" onclick={finish}>Not now</button>
		</div>
	{:else if mode === 'install'}
		<div class="step-main">
			<p class="kicker">Install</p>
			<h1>Add Pokedex</h1>
			<p class="lede">Use the install prompt when your browser offers it. That adds Pokedex to your home screen or desktop.</p>
			<Art name="home" />
			{#if message}<p class="meta">{message}</p>{/if}
		</div>
		<div class="step-footer stack">
			{#if promptEvent}
				<button class="pill full" type="button" disabled={busy} onclick={install}>
					Install <span aria-hidden="true">→</span>
				</button>
				<button class="text-btn" type="button" onclick={() => (mode = 'notes')}>Not now</button>
			{:else}
				<button class="pill full" type="button" onclick={() => (mode = 'notes')}>
					Continue <span aria-hidden="true">→</span>
				</button>
			{/if}
		</div>
	{:else if guide}
		<div class="step-main">
			<p class="kicker">{guide.kicker}</p>
			<h1>{guide.title}</h1>
			<p class="lede">{guide.lede}</p>
			<HomeGuide client={client} />
			{#if message}<p class="meta" style="margin-top: 12px" aria-live="polite">{message}</p>{/if}
		</div>
		<div class="step-footer stack">
			<button class="pill full" type="button" onclick={acknowledge}>I'll open the icon</button>
			<button class="text-btn" type="button" onclick={finish}>Not now</button>
		</div>
	{/if}
</section>
