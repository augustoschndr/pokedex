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
	import { enablePush, ensurePushSubscription, type PushDeviceState } from '$lib/push';
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
	let pushState = $state<PushDeviceState | 'unknown'>('unknown');
	let testNote = $state('');
	let testing = $state(false);
	const theme = $derived(pendingTheme ?? data.theme);
	const ready = $derived(confirm === phrase);
	const guide = $derived(client ? homeScreenCopy(client) : null);

	function pushLabel(state: PushDeviceState | 'unknown'): string {
		if (state === 'on') return 'This device is subscribed.';
		if (state === 'denied') return 'Notifications are blocked in system settings.';
		if (state === 'needs-home') return 'This tab is not subscribed.';
		if (state === 'unsupported') return 'This browser cannot show notifications.';
		if (state === 'error') return 'This device could not be saved.';
		if (state === 'off') return 'Notifications are off on this device.';
		return 'Checking this device.';
	}

	onMount(() => {
		client = detectInstallClient();
		void ensurePushSubscription(data.vapidPublicKey).then((state) => {
			pushState = state;
		});
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
		testNote = '';
		try {
			const result = await enablePush(data.vapidPublicKey);
			message = result.message;
			pushState = result.ok ? 'on' : await ensurePushSubscription(data.vapidPublicKey);
		} catch {
			error = 'Notifications stay off';
		}
	}

	async function sendTest() {
		testing = true;
		testNote = '';
		error = '';
		const response = await fetch('/api/v1/push/test', { method: 'POST' });
		testing = false;
		let body: { error?: string; results?: { status: number; reason?: string }[] } = {};
		try {
			body = await response.json();
		} catch {
			error = 'Test notification was not sent';
			return;
		}
		if (!response.ok) {
			error =
				body.error === 'invalid_vapid_subject' || body.error === 'not_configured'
					? 'Notifications are not configured on this server'
					: 'Test notification was not sent';
			return;
		}
		if (!body.results?.length) {
			testNote = 'No device is saved on the server yet';
			return;
		}
		testNote = body.results
			.map((row) => (row.reason ? `Status ${row.status} ${row.reason}` : `Status ${row.status}`))
			.join(', ');
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
		{:else}
			<p class="meta">A short push when a brief arrives. On iPhone and iPad this works only in the Home Screen app.</p>
		{/if}
		<p class="meta">{pushLabel(pushState)}</p>
		{#if pushState === 'off' || pushState === 'error'}
			<button class="pill" type="button" onclick={notes}>Enable notifications</button>
		{/if}
		{#if pushState === 'on'}
			<button class="pill" type="button" disabled={testing} onclick={sendTest}>Send test notification</button>
		{/if}
		{#if testNote}<p class="meta">{testNote}</p>{/if}
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
