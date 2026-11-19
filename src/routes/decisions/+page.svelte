<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import SettingsLink from '$lib/components/SettingsLink.svelte';

	let { data } = $props();
	let open = $state<string | null>(null);
	let comment = $state('');
	let busy = $state<string | null>(null);
	let error = $state('');

	async function answer(id: string, action: 'approved' | 'rejected' | 'commented') {
		error = '';
		const field = document.getElementById(`comment-${id}`);
		const text = (field instanceof HTMLTextAreaElement ? field.value : comment).trim();
		if (action === 'commented' && !text) {
			error = 'Write the comment first';
			return;
		}
		busy = id;
		const response = await fetch(`/api/v1/decisions/${encodeURIComponent(id)}/answer`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ action, comment: text })
		});
		busy = null;
		if (!response.ok) {
			error = 'Could not save that answer';
			return;
		}
		comment = '';
		open = null;
		await invalidateAll();
	}

	function label(status: string): string {
		if (status === 'approved') return 'Approved';
		if (status === 'rejected') return 'Rejected';
		if (status === 'commented') return 'Commented';
		return 'Waiting';
	}
</script>

<svelte:head><title>Decisions · Pokedex</title></svelte:head>

<main>
	<div class="toprow">
		<div class="titles">
			<p class="kicker">Waiting on you</p>
			<h1>Decisions</h1>
		</div>
		<SettingsLink />
	</div>
	{#if error}<p class="error" role="alert">{error}</p>{/if}
	{#if data.decisions.length === 0}
		<p class="lede">Nothing waiting on you.</p>
	{:else}
		<div class="stack" style="margin-top: 20px">
			{#each data.decisions as item}
				<article class="card">
					<div class="week-top">
						<h2>{item.title}</h2>
						<span class="chip">
							<span class="dot {item.status === 'approved' ? 'ok' : item.status === 'rejected' ? 'warn' : ''}"></span>
							{label(item.status)}
						</span>
					</div>
					{#if item.detail}<p class="meta" style="margin-top: 8px">{item.detail}</p>{/if}
					{#if item.status !== 'pending' && item.comment}
						<p class="answered meta">{item.comment}</p>
					{/if}
					{#if item.status === 'pending' || open === item.id}
						<div class="actions">
							<button class="pill" type="button" disabled={busy === item.id} onclick={() => answer(item.id, 'approved')}>Approve</button>
							<button class="pill secondary" type="button" disabled={busy === item.id} onclick={() => answer(item.id, 'rejected')}>Reject</button>
						</div>
						{#if open === item.id}
							<label class="small muted" for={"comment-" + item.id} style="display:block;margin-top:12px">Comment</label>
							<textarea id={"comment-" + item.id} class="field" bind:value={comment}></textarea>
							<button class="pill full" style="margin-top: 8px" type="button" disabled={busy === item.id} onclick={() => answer(item.id, 'commented')}>
								Send comment <span aria-hidden="true">→</span>
							</button>
						{:else}
							<button class="text-btn" type="button" onclick={() => { open = item.id; comment = ''; }}>Comment</button>
						{/if}
					{:else}
						<button class="text-btn" type="button" onclick={() => { open = item.id; comment = item.comment ?? ''; }}>Change answer</button>
					{/if}
				</article>
			{/each}
		</div>
	{/if}
</main>
