<script lang="ts">
	import { goto } from '$app/navigation';
	import { enablePush } from '$lib/push';

	let { data } = $props();
	const phrase = 'DELETE MY POKEDEX DATA';
	let confirm = $state('');
	let message = $state('');
	let error = $state('');
	let busy = $state(false);
	const ready = $derived(confirm === phrase);

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
		<h2>Notifications</h2>
		<p class="meta">A short push when a brief arrives. On iPhone this needs the Home Screen app.</p>
		<button class="pill" type="button" onclick={notes}>Enable notifications</button>
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
