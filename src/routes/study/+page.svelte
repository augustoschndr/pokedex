<script lang="ts">
	import StudyBlock from '$lib/components/StudyBlock.svelte';

	let { data } = $props();
	const empty = $derived(data.study.blocks.length === 0 && data.reels_rules.blocks.length === 0);
</script>

<main>
	<a class="back-btn" href="/more">
		<svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
			<path d="M11 4L6 9l5 5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
		</svg>
		More
	</a>
	<div class="titles" style="margin-top: 12px">
		<p class="kicker">Notes</p>
		<h1>Study</h1>
	</div>
	{#if data.study.intro}<p class="lede">{data.study.intro}</p>{/if}
	{#if empty}
		<p class="lede">No notes yet.</p>
	{:else}
		<div class="stack" style="margin-top: 20px">
			{#each data.study.blocks as block}
				<StudyBlock {block} />
			{/each}
		</div>
		{#if data.reels_rules.blocks.length}
			<section class="section">
				<p class="kicker">Reels rules</p>
				{#if data.reels_rules.intro}<p class="lede">{data.reels_rules.intro}</p>{/if}
				<div class="stack" style="margin-top: 12px">
					{#each data.reels_rules.blocks as block}
						<StudyBlock {block} />
					{/each}
				</div>
			</section>
		{/if}
	{/if}
</main>
