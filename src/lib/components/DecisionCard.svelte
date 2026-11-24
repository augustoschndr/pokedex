<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { DECISION_CHOICES, optionLabel, type DecisionAction } from '$lib/decisions';
	import type { DecisionView } from '$lib/server/content';

	let { item }: { item: DecisionView } = $props();

	let open = $state(false);
	let comment = $state('');
	let busy = $state(false);
	let error = $state('');
	let picked = $state<string | null>(null);

	const status = $derived(picked ?? item.status);
	const chosen = $derived(status === 'pending' ? null : optionLabel(status));

	async function answer(action: DecisionAction) {
		error = '';
		const text = comment.trim();
		if (action === 'commented' && !text) {
			error = 'Write the comment first';
			return;
		}
		busy = true;
		const response = await fetch(`/api/v1/decisions/${encodeURIComponent(item.id)}/answer`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ action, comment: text })
		});
		busy = false;
		if (!response.ok) {
			error = 'Could not save that choice';
			return;
		}
		picked = action;
		comment = '';
		open = false;
		await invalidateAll();
		picked = null;
	}
</script>

<article class="card decision">
	<h2>{item.title}</h2>
	{#if item.detail}<p class="meta" style="margin-top: 8px">{item.detail}</p>{/if}
	{#if chosen}
		<p class="chosen" style="margin-top: 12px">{chosen}</p>
	{/if}
	{#if item.comment && status !== 'pending'}
		<p class="answered meta">{item.comment}</p>
	{/if}
	{#if error}<p class="error" role="alert">{error}</p>{/if}
	{#if status === 'pending' || open}
		<div class="stack" style="margin-top: 12px">
			{#each DECISION_CHOICES as choice}
				<button class="option" type="button" disabled={busy} onclick={() => answer(choice.action)}>{choice.label}</button>
			{/each}
		</div>
		{#if open}
			<label class="small muted" for={'comment-' + item.id} style="display:block;margin-top:12px">Comment</label>
			<textarea id={'comment-' + item.id} class="field" bind:value={comment}></textarea>
			<button class="pill full" style="margin-top: 8px" type="button" disabled={busy} onclick={() => answer('commented')}>
				Send comment
			</button>
		{:else}
			<button class="text-btn" type="button" onclick={() => (open = true)}>Comment</button>
		{/if}
	{:else}
		<button
			class="text-btn"
			type="button"
			onclick={() => {
				open = true;
				comment = item.comment ?? '';
			}}
		>
			Change choice
		</button>
	{/if}
</article>
