<script lang="ts">
	import Tags from '$lib/components/Tags.svelte';

	let { data } = $props();
	const width = $derived(data.total ? Math.round((data.done / data.total) * 100) : 0);
</script>

<main>
	<p class="kicker">{data.dateLabel || 'This week'}</p>
	<h1>Week</h1>
	{#if data.intro}<p class="meta" style="margin-top: 8px">{data.intro}</p>{/if}

	{#if data.total === 0}
		<p class="lede">Nothing this week.</p>
	{:else}
		<p class="meta" style="margin-top: 16px">{data.done} of {data.total}</p>
		<div class="meter" role="img" aria-label="{data.done} of {data.total} done">
			<span style:width="{width}%"></span>
		</div>
		<div class="stack" style="margin-top: 16px">
			{#each data.items as item (item.kind + item.id)}
				<a class="card prep-link week-row" class:done={item.done} href={item.href}>
					<p class="small muted">{item.dateLabel}</p>
					<p class="guide-title" style="margin-top: 4px">{item.title}</p>
					<Tags phase={item.phase} frame={item.frame} />
					{#if item.slipped && item.movedFrom}
						<p class="slipped">Moved from {item.movedFrom}</p>
					{/if}
				</a>
			{/each}
		</div>
	{/if}
</main>
