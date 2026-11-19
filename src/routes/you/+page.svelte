<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import SettingsLink from '$lib/components/SettingsLink.svelte';

	let { data } = $props();
	let busy = $state<string | null>(null);
	let error = $state('');

	async function toggle(id: string) {
		error = '';
		busy = id;
		const response = await fetch(`/api/v1/todos/${encodeURIComponent(id)}/toggle`, { method: 'POST' });
		busy = null;
		if (!response.ok) {
			error = 'Could not update that item';
			return;
		}
		await invalidateAll();
	}
</script>

<svelte:head><title>Only you · Pokedex</title></svelte:head>

<main>
	<div class="toprow">
		<div class="titles">
			<p class="kicker">Physical</p>
			<h1>Only you</h1>
		</div>
		<SettingsLink />
	</div>
	{#if data.intro}<p class="lede">{data.intro}</p>{/if}
	{#if error}<p class="error" role="alert">{error}</p>{/if}
	{#if data.items.length === 0}
		<p class="lede">Nothing on your list.</p>
	{:else}
		<div class="card" style="margin-top: 20px">
			{#each data.items as item}
				<div class="todo" class:done={item.done}>
					<button
						class="check"
						type="button"
						aria-pressed={item.done}
						aria-label={item.done ? `Mark not done: ${item.text}` : `Mark done: ${item.text}`}
						disabled={busy === item.id}
						onclick={() => toggle(item.id)}
					>
						<i>
							{#if item.done}
								<svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
									<path d="M2.5 7.2l3 3 6-6.5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" />
								</svg>
							{/if}
						</i>
					</button>
					<div class="todo-copy">
						<p class="todo-text">{item.text}</p>
						{#if item.meta}<p class="small muted" style="margin-top: 4px">{item.meta}</p>{/if}
					</div>
				</div>
			{/each}
		</div>
	{/if}
</main>
