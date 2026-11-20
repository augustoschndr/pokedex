<script lang="ts">
	import { onMount } from 'svelte';

	let { title, text, onclose }: { title: string; text: string; onclose: () => void } = $props();

	let scroller = $state<HTMLDivElement | null>(null);
	let speed = $state(0);
	let reduced = $state(false);

	const speeds = [
		{ value: 0, label: 'Off' },
		{ value: 28, label: 'Slow' },
		{ value: 52, label: 'Medium' },
		{ value: 84, label: 'Fast' }
	];

	onMount(() => {
		reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		const onKey = (event: KeyboardEvent) => {
			if (event.key === 'Escape') onclose();
		};
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	});

	$effect(() => {
		const node = scroller;
		const px = speed;
		if (!node || px <= 0 || reduced) return;
		let frame = 0;
		let last = performance.now();
		const step = (now: number) => {
			node.scrollTop += (px * (now - last)) / 1000;
			last = now;
			frame = requestAnimationFrame(step);
		};
		frame = requestAnimationFrame(step);
		return () => cancelAnimationFrame(frame);
	});
</script>

<div class="prompter" role="dialog" aria-modal="true" aria-label="Script">
	<div class="prompter-bar">
		<button class="text-btn" type="button" onclick={onclose}>Close</button>
		{#if !reduced}
			<div class="speed" role="radiogroup" aria-label="Auto-scroll">
				{#each speeds as option}
					<button
						type="button"
						role="radio"
						aria-checked={speed === option.value}
						onclick={() => (speed = option.value)}
					>
						{option.label}
					</button>
				{/each}
			</div>
		{/if}
	</div>
	<div class="prompter-scroll" bind:this={scroller}>
		<p class="kicker">{title}</p>
		<p class="prompter-text">{text}</p>
	</div>
</div>
