<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import SettingsLink from '$lib/components/SettingsLink.svelte';
	import { takeCheckPress } from '$lib/check-press';
	import { createToggleQueue } from '$lib/toggle-queue';

	let { data } = $props();
	let overrides = $state<Record<string, boolean>>({});
	let error = $state('');

	const queues = new Map<string, (post: () => Promise<boolean>) => void>();

	function shown(id: string, done: boolean) {
		return id in overrides ? overrides[id] : done;
	}

	function queueFor(id: string) {
		const existing = queues.get(id);
		if (existing) return existing;
		const queue = createToggleQueue({
			onFail: () => {
				delete overrides[id];
				error = 'Could not update that item';
			},
			onIdle: async () => {
				await invalidateAll();
				const item = data.items.find((row: { id: string; done: boolean }) => row.id === id);
				if (item && id in overrides && overrides[id] === item.done) delete overrides[id];
			}
		});
		queues.set(id, queue);
		return queue;
	}

	function flip(id: string, done: boolean) {
		error = '';
		overrides[id] = !shown(id, done);
		queueFor(id)(async () => {
			const response = await fetch(`/api/v1/todos/${encodeURIComponent(id)}/toggle`, { method: 'POST' });
			return response.ok;
		});
	}
</script>

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
				<div class="todo" class:done={shown(item.id, item.done)}>
					<button
						class="check"
						type="button"
						aria-pressed={shown(item.id, item.done)}
						aria-label={shown(item.id, item.done) ? `Mark not done: ${item.text}` : `Mark done: ${item.text}`}
						onpointerdown={(event) => {
							if (takeCheckPress(event)) flip(item.id, item.done);
						}}
						onclick={(event) => {
							if (takeCheckPress(event)) flip(item.id, item.done);
						}}
					>
						<i>
							{#if shown(item.id, item.done)}
								<svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
									<path d="M2.5 7.2l3 3 6-6.5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" />
								</svg>
							{/if}
						</i>
					</button>
					<a class="stretch todo-copy" href="/you/{item.id}">
						<p class="todo-text">{item.text}</p>
						{#if item.meta}<p class="small muted" style="margin-top: 4px">{item.meta}</p>{/if}
					</a>
				</div>
			{/each}
		</div>
	{/if}
</main>
