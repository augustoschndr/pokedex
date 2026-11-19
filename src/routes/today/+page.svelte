<script lang="ts">
	import Diagram from '$lib/components/Diagram.svelte';
	import SettingsLink from '$lib/components/SettingsLink.svelte';

	let { data } = $props();
	const today = $derived(data.today);
</script>

<svelte:head><title>Today · Pokedex</title></svelte:head>

<main>
	<div class="toprow">
		<p class="kicker">{today?.date_label ?? 'Today'}</p>
		<SettingsLink />
	</div>
	{#if !today}
		<h1>No lesson yet</h1>
		<p class="lede">The weekday brief shows up here when it is posted.</p>
	{:else}
		<h1>{today.lesson ?? 'Today'}</h1>
		<svg class="underline" viewBox="0 0 72 8" aria-hidden="true">
			<path d="M2 5 C 16 2, 28 7, 40 4 S 60 2, 70 5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
		</svg>
		{#if today.pillar || today.where_it_goes}
			<div class="chips">
				{#if today.pillar}<span class="chip">{today.pillar}</span>{/if}
				{#if today.where_it_goes}<span class="chip">{today.where_it_goes}</span>{/if}
			</div>
		{/if}
		<div class="stack" style="margin-top: 20px">
			{#if today.hook}
				<article class="card fold">
					<svg class="dogear" viewBox="0 0 28 28" aria-hidden="true">
						<path d="M0 0h28L0 28z" fill="#fbf7f3" />
						<path d="M0 0h28L0 28" fill="none" stroke="#171513" stroke-width="1.5" />
					</svg>
					<h2>Hook</h2>
					<p style="margin-top: 8px">{today.hook}</p>
				</article>
			{/if}
			{#if today.talking_points.length}
				<article class="card">
					<h2>Talking points</h2>
					<ol class="points">
						{#each today.talking_points as point}<li>{point}</li>{/each}
					</ol>
				</article>
			{/if}
			{#if today.whiteboard}
				<article class="card">
					<h2>Whiteboard</h2>
					<div style="margin-top: 12px"><Diagram diagram={today.whiteboard} /></div>
				</article>
			{/if}
			{#if today.cta}
				<article class="card">
					<h2>Close</h2>
					<p style="margin-top: 8px">{today.cta}</p>
				</article>
			{/if}
			{#if today.body}
				<article class="card">
					<h2>Notes</h2>
					<p class="meta" style="margin-top: 8px">{today.body}</p>
				</article>
			{/if}
		</div>
	{/if}
</main>
