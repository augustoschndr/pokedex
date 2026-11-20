<script lang="ts">
	import ShareIcon from '$lib/components/ShareIcon.svelte';
	import { homeScreenCopy, type InstallClient } from '$lib/install';

	let { client }: { client: InstallClient } = $props();
	const copy = $derived(homeScreenCopy(client));
</script>

{#if copy}
	<ol class="guide">
		{#each copy.steps as step, index}
			<li class="card guide-card">
				<span class="step-n" aria-hidden="true">{index + 1}</span>
				<div class="guide-copy">
					<p class="guide-title">{step.title}</p>
					<p class="small">{step.body}</p>
				</div>
				{#if step.shareIcon}
					<ShareIcon size={46} />
				{/if}
			</li>
		{/each}
	</ol>
{/if}
