<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { onMount } from 'svelte';
	import HomeGuide from '$lib/components/HomeGuide.svelte';
	import {
		detectInstallClient,
		homeScreenCopy,
		listenForInstallPrompt,
		runInstallPrompt,
		type BeforeInstallPromptEvent,
		type InstallClient
	} from '$lib/install';
	import { enablePush } from '$lib/push';
	import { applyTheme, type ThemeChoice } from '$lib/theme';

	let { data } = $props();
	const phrase = 'DELETE MY POKEDEX DATA';
	let confirm = $state('');
	let message = $state('');
	let error = $state('');
	let busy = $state(false);
	let pendingTheme = $state<ThemeChoice | null>(null);
	let client = $state<InstallClient | null>(null);
	let promptEvent = $state<BeforeInstallPromptEvent | null>(null);
	const theme = $derived(pendingTheme ?? data.theme);
	const ready = $derived(confirm === phrase);
	const guide = $derived(client ? homeScreenCopy(client) : null);

	onMount(() => {
		client = detectInstallClient();
		return listenForInstallPrompt((event) => {
			promptEvent = event;
		});
	});

	async function choose(next: ThemeChoice) {
		pendingTheme = next;
		applyTheme(next);
		error = '';
		const response = await fetch('/api/v1/me/theme', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ theme: next })
		});
		if (!response.ok) {
			pendingTheme = null;
			error = 'Theme was not saved';
			return;
		}
		await invalidateAll();
		pendingTheme = null;
	}

	async function download() {
		error = '';
		const response = await fetch('/api/v1/me/export');
		if (!response.ok) {
			error = 'Could not export';
			return;
		}
		const blob = await response.blob();
		const url = URL.createObjectURL(blob);
		const link = document.createElement('a');
		const day = new Date().toISOString().slice(0, 10);
		link.href = url;
		link.download = `pokedex-export-${day}.json`;
		link.click();
		URL.revokeObjectURL(url);
	}

	async function notes() {
		message = '';
		error = '';
		try {
			const result = await enablePush(data.vapidPublicKey);
			message = result.message;
		} catch {
			error = 'Notifications stay off';
		}
	}

	async function install() {
		if (!promptEvent) return;
		message = '';
		try {
			const outcome = await runInstallPrompt(promptEvent);
			promptEvent = null;
			message = outcome === 'accepted' ? 'Pokedex is installing' : 'Install dismissed';
		} catch {
			error = 'Install did not finish';
		}
	}

	async function wipe(keep: boolean) {
		if (!ready) return;
		error = '';
		busy = true;
		const response = await fetch('/api/v1/me/delete', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ confirm: phrase, keep_passkey: keep })
		});
		busy = false;
		if (!response.ok) {
			error = 'Nothing was deleted';
			return;
		}
		const body = (await response.json()) as { redirect?: string };
		await goto(body.redirect ?? '/login');
	}

	async function logout() {
		await fetch('/api/v1/auth/logout', { method: 'POST' });
		await goto('/login');
	}
</script>

<svelte:head><title>Settings · Pokedex</title></svelte:head>

<main class="settings">
	<a class="text-btn" href="/today">Back</a>
	<h1 style="margin-top: 8px">Settings</h1>
	<p class="meta" style="margin-top: 8px">{data.name}</p>
	<p class="small muted">{data.passkeys} passkey · {data.push} notification device</p>

	<section class="section stack">
		<h2>Theme</h2>
		<p class="meta">System follows this device. Light and Dark stay put.</p>
		<div class="theme-picker" role="radiogroup" aria-label="Theme">
			<button type="button" role="radio" aria-checked={theme === 'light'} onclick={() => choose('light')}>Light</button>
			<button type="button" role="radio" aria-checked={theme === 'dark'} onclick={() => choose('dark')}>Dark</button>
			<button type="button" role="radio" aria-checked={theme === 'system'} onclick={() => choose('system')}>System</button>
		</div>
	</section>

	{#if client && !client.standalone}
		<section class="section stack">
			<h2>Home Screen</h2>
			{#if guide}
				<p class="meta">{guide.lede}</p>
				<HomeGuide {client} />
			{:else if promptEvent}
				<p class="meta">Your browser can install Pokedex on the home screen or desktop.</p>
				<button class="pill" type="button" onclick={install}>Install</button>
			{:else}
				<p class="meta">If the browser menu offers Install app, you can add Pokedex there. This page has no install prompt right now.</p>
			{/if}
		</section>
	{/if}

	<section class="section stack">
		<h2>Notifications</h2>
		{#if client?.ios && !client.standalone}
			<p class="meta">iPhone and iPad only allow notifications from the Home Screen app. Add Pokedex, open the icon, then enable them here.</p>
		{:else if client?.ios}
			<p class="meta">A short push when a brief arrives. This Home Screen app is where iPhone and iPad allow them.</p>
			<button class="pill" type="button" onclick={notes}>Enable notifications</button>
		{:else}
			<p class="meta">A short push when a brief arrives. On iPhone and iPad this works only in the Home Screen app.</p>
			{#if client}
				<button class="pill" type="button" onclick={notes}>Enable notifications</button>
			{/if}
		{/if}
		{#if message}<p class="meta">{message}</p>{/if}
	</section>

	<section class="section stack">
		<h2>Your data</h2>
		<p class="meta">Export is a JSON file of everything stored here. It leaves nothing but your phone.</p>
		<button class="pill secondary" type="button" onclick={download}>Export all</button>
	</section>

	<section class="section card">
		<h2>Delete everything</h2>
		<p class="meta" style="margin-top: 8px">Type {phrase} to confirm. This cannot be undone.</p>
		<input class="field" style="margin-top: 12px" bind:value={confirm} autocomplete="off" spellcheck="false" />
		<div class="stack" style="margin-top: 12px">
			<button class="pill secondary full" type="button" disabled={!ready || busy} onclick={() => wipe(true)}>
				Delete data, keep passkey
			</button>
			<button class="pill full" type="button" disabled={!ready || busy} onclick={() => wipe(false)}>
				Delete data and passkey
			</button>
		</div>
	</section>

	{#if error}<p class="error" role="alert">{error}</p>{/if}

	<button class="text-btn" style="margin-top: 28px" type="button" onclick={logout}>Sign out</button>
</main>
