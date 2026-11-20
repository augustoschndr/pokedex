<script lang="ts">
	import { onMount } from 'svelte';
	import Mark from './Mark.svelte';

	let open = $state(true);
	let closing = $state(false);
	let canvas = $state<HTMLCanvasElement | null>(null);
	let root = $state<HTMLDivElement | null>(null);

	function onFadeEnd(event: TransitionEvent) {
		if (event.propertyName === 'opacity' && closing) open = false;
	}

	onMount(() => {
		const hold = new URLSearchParams(location.search).has('splash');
		const skip = document.documentElement.dataset.splash === 'skip' && !hold;
		if (skip) {
			open = false;
			return;
		}

		const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		const started = performance.now();
		const minMs = reduced ? 520 : 1100;
		const maxMs = reduced ? 720 : 1800;
		let stop = () => {};
		let finished = false;
		let tail = 0;

		const dismiss = () => {
			if (finished || hold) return;
			finished = true;
			window.clearTimeout(cap);
			window.clearTimeout(tail);
			stop();
			closing = true;
		};

		const cap = window.setTimeout(dismiss, maxMs);
		const ready = (async () => {
			if (reduced || !canvas) return;
			const lens = await import('$lib/splash/lens');
			if (!lens.canUseWebGL()) return;
			stop = await lens.mountLens(canvas, hold);
		})().catch(() => {});

		void ready.finally(() => {
			if (root) root.dataset.ready = '1';
			tail = window.setTimeout(dismiss, Math.max(0, minMs - (performance.now() - started)));
		});

		return () => {
			finished = true;
			window.clearTimeout(cap);
			window.clearTimeout(tail);
			stop();
		};
	});
</script>

{#if open}
	<div
		class="splash"
		class:is-out={closing}
		bind:this={root}
		role="status"
		aria-label="Opening Pokedex"
		ontransitionend={onFadeEnd}
	>
		<div class="splash-stage">
			<canvas bind:this={canvas} aria-hidden="true"></canvas>
			<Mark />
		</div>
	</div>
{/if}
