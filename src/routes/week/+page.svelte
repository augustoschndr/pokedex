<script lang="ts">
	import SettingsLink from '$lib/components/SettingsLink.svelte';

	let { data } = $props();
</script>

<svelte:head><title>This week · Pokedex</title></svelte:head>

<main>
	<div class="toprow">
		<div class="titles">
			<p class="kicker">Shot list</p>
			<h1>This week</h1>
		</div>
		<SettingsLink />
	</div>
	{#if data.intro}<p class="lede">{data.intro}</p>{/if}
	{#if data.items.length === 0}
		<p class="lede">No shots on the list yet.</p>
	{:else}
		<div class="stack" style="margin-top: 20px">
			{#each data.items as item}
				<article class="card">
					<div class="week-top">
						<span class="lead">{item.lead}</span>
						{#if item.status}
							<span class="chip">
								<span class="dot {item.status.tone === 'default' ? '' : item.status.tone === 'warning' ? 'warn' : item.status.tone === 'success' ? 'ok' : 'info'}"></span>
								{item.status.label}
							</span>
						{/if}
					</div>
					<h2 style="margin-top: 8px">{item.title}</h2>
					{#if item.detail}<p class="meta" style="margin-top: 6px">{item.detail}</p>{/if}
					{#if item.meta}<p class="small muted" style="margin-top: 8px">{item.meta}</p>{/if}
				</article>
			{/each}
		</div>
	{/if}
</main>
