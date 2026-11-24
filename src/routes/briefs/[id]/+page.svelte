<script lang="ts">
	import LessonBrief from '$lib/components/LessonBrief.svelte';

	let { data } = $props();
</script>

<svelte:head><title>{data.brief.lesson ?? 'Brief'} · Pokedex</title></svelte:head>

<main>
	<a class="back-btn" href="/briefs">
		<svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
			<path d="M11 4L6 9l5 5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
		</svg>
		Briefs
	</a>
	<div style="margin-top: 12px">
		<LessonBrief brief={data.brief} />
	</div>
</main>
