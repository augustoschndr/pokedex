<script lang="ts">
	import DecisionCard from '$lib/components/DecisionCard.svelte';

	let { data } = $props();
</script>

<main>
	<a class="back-btn" href="/more">
		<svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
			<path d="M11 4L6 9l5 5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
		</svg>
		More
	</a>
	<h1 style="margin-top: 12px">Decisions</h1>
	{#if data.decisions.length === 0}
		<p class="lede">Nothing waiting on you.</p>
	{:else}
		<div class="stack" style="margin-top: 20px">
			{#each data.decisions as item (item.id)}
				<DecisionCard {item} />
			{/each}
		</div>
	{/if}
</main>
