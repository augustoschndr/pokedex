<script lang="ts">
	import SettingsLink from '$lib/components/SettingsLink.svelte';
	import StudyBlock from '$lib/components/StudyBlock.svelte';

	let { data } = $props();
	const empty = $derived(data.study.blocks.length === 0 && data.reels_rules.blocks.length === 0);
</script>

<svelte:head><title>Study · Pokedex</title></svelte:head>

<main>
	<div class="toprow">
		<div class="titles">
			<p class="kicker">Notes</p>
			<h1>Study</h1>
		</div>
		<SettingsLink />
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
