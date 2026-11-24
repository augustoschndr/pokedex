<script lang="ts">
	import { phaseLabel } from '$lib/frame';

	let { phase = null, frame = null }: { phase?: string | null; frame?: string | null } = $props();
	const phaseText = $derived(frame ? phaseLabel(phase) : (phase ?? ''));
</script>

{#if phase || frame}
	<div class="chips">
		{#if phaseText}<span class="chip">{phaseText}</span>{/if}
		{#if frame}<span class="chip">{frame}</span>{/if}
	</div>
{/if}
