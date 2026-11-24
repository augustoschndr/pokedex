<script lang="ts">
	let { data } = $props();
</script>

<svelte:head><title>Briefs · Pokedex</title></svelte:head>

<main>
	<a class="back-btn" href="/more">
		<svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
			<path d="M11 4L6 9l5 5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
		</svg>
		More
	</a>
	<h1 style="margin-top: 12px">Briefs</h1>
	{#if data.briefs.length === 0}
		<p class="lede">No briefs yet.</p>
	{:else}
		<div class="stack" style="margin-top: 16px">
			{#each data.briefs as brief (brief.id)}
				<a class="card prep-link" href="/briefs/{brief.id}">
					<p class="guide-title">{brief.lesson ?? 'Brief'}</p>
					<p class="small muted" style="margin-top: 4px">
						{brief.current ? 'Current' : (brief.date_label ?? brief.for_date ?? 'Earlier')}
					</p>
				</a>
			{/each}
		</div>
	{/if}
</main>
