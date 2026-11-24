<script lang="ts">
	import Diagram from '$lib/components/Diagram.svelte';
	import type { TodayView } from '$lib/server/content';

	let { brief }: { brief: TodayView } = $props();
</script>

<h1>{brief.lesson ?? 'Brief'}</h1>
{#if brief.date_label}<p class="meta" style="margin-top: 8px">{brief.date_label}</p>{/if}
{#if brief.pillar || brief.where_it_goes}
	<div class="chips">
		{#if brief.pillar}<span class="chip">{brief.pillar}</span>{/if}
		{#if brief.where_it_goes}<span class="chip">{brief.where_it_goes}</span>{/if}
	</div>
{/if}
<div class="stack" style="margin-top: 20px">
	{#if brief.hook}
		<article class="card fold">
			<svg class="dogear" viewBox="0 0 28 28" aria-hidden="true">
				<path d="M0 0h28L0 28z" fill="var(--bg)" />
				<path d="M0 0h28L0 28" fill="none" stroke="currentColor" stroke-width="1.5" />
			</svg>
			<h2>Hook</h2>
			<p style="margin-top: 8px">{brief.hook}</p>
		</article>
	{/if}
	{#if brief.talking_points.length}
		<article class="card">
			<h2>Talking points</h2>
			<ol class="points">
				{#each brief.talking_points as point}<li>{point}</li>{/each}
			</ol>
		</article>
	{/if}
	{#if brief.whiteboard}
		<article class="card">
			<h2>Whiteboard</h2>
			<div style="margin-top: 12px"><Diagram diagram={brief.whiteboard} /></div>
		</article>
	{/if}
	{#if brief.cta}
		<article class="card">
			<h2>Close</h2>
			<p style="margin-top: 8px">{brief.cta}</p>
		</article>
	{/if}
	{#if brief.body}
		<article class="card">
			<h2>Notes</h2>
			<p class="meta" style="margin-top: 8px">{brief.body}</p>
		</article>
	{/if}
</div>
