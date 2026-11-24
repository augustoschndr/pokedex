<script lang="ts">
	import PlanPhase from '$lib/components/PlanPhase.svelte';

	let { data } = $props();
</script>

<svelte:head><title>{data.phase.title} · Pokedex</title></svelte:head>

<main>
	<a class="back-btn" href="/plan">
		<svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
			<path d="M11 4L6 9l5 5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
		</svg>
		Plan
	</a>
	<div style="margin-top: 12px">
		<PlanPhase phase={data.phase} />
	</div>
</main>
