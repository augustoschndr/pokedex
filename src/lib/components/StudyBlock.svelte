<script lang="ts">
	import Diagram from './Diagram.svelte';
	import type { StudyBlock } from '$lib/types';

	let { block }: { block: StudyBlock } = $props();
</script>

<article class="card" class:callout={block.kind === 'callout'}>
	{#if block.heading}<h2>{block.heading}</h2>{/if}
	{#if block.lead}<p class="kicker" style="margin-top: 6px">{block.lead}</p>{/if}
	{#if block.kind === 'equation' && block.equation}
		<p class="equation">{block.equation}</p>
	{/if}
	{#if block.text}<p class="meta" style="margin-top: 8px">{block.text}</p>{/if}
	{#if block.kind === 'steps' && block.steps}
		<ol class="steps">
			{#each block.steps as step, i}
				<li>
					<span class="step-n">{i + 1}</span>
					<div>
						<strong>{step.title}</strong>
						{#if step.detail}<p class="meta">{step.detail}</p>{/if}
					</div>
				</li>
			{/each}
		</ol>
	{/if}
	{#if block.kind === 'rows' && block.rows}
		<div class="stack" style="margin-top: 12px">
			{#each block.rows as row}
				<div>
					{#if row.lead}<span class="chip">{row.lead}</span>{/if}
					<p style="margin-top: 6px"><strong>{row.title}</strong></p>
					{#if row.detail}<p class="meta">{row.detail}</p>{/if}
				</div>
			{/each}
		</div>
	{/if}
	{#if block.kind === 'list' && block.items}
		<ul class="points">
			{#each block.items as item}<li>{item}</li>{/each}
		</ul>
	{/if}
	{#if block.kind === 'diagram' && block.diagram}
		<div style="margin-top: 12px">
			<Diagram diagram={block.diagram} />
		</div>
	{/if}
</article>
