<script lang="ts">
	let { phase = null, frame = null }: { phase?: string | null; frame?: string | null } = $props();
</script>

{#if phase || frame}
	<div class="chips">
		{#if phase}<span class="chip">{phase}</span>{/if}
		{#if frame}<span class="chip">{frame}</span>{/if}
	</div>
{/if}
