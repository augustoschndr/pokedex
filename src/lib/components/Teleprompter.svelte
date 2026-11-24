<script lang="ts">
	import { onMount } from 'svelte';
	import { SPEED_KEY, clampSpeed } from '$lib/prompter';

	let { title, text, onclose }: { title: string; text: string; onclose: () => void } = $props();

	const sizes = [28, 34, 40, 48, 56];

	let scroller = $state<HTMLDivElement | null>(null);
	let speed = $state(48);
	let sizeIndex = $state(2);
	let mirror = $state(false);
	let phase = $state<'count' | 'play' | 'pause'>('count');
	let count = $state(3);

	let countTimer = 0;
	let disposed = false;
	let tapX = 0;
	let tapY = 0;

	const size = $derived(sizes[sizeIndex]);
	const playing = $derived(phase === 'play');

	function beginCountdown() {
		window.clearTimeout(countTimer);
		phase = 'count';
		count = 3;
		const tick = () => {
			if (disposed) return;
			if (count <= 1) {
				phase = 'play';
				return;
			}
			count -= 1;
			countTimer = window.setTimeout(tick, 1000);
		};
		countTimer = window.setTimeout(tick, 1000);
	}

	function togglePlay() {
		if (phase === 'count') {
			window.clearTimeout(countTimer);
			phase = 'pause';
			return;
		}
		phase = phase === 'play' ? 'pause' : 'play';
	}

	function restart() {
		if (scroller) scroller.scrollTop = 0;
		beginCountdown();
	}

	function setSpeed(next: number) {
		speed = clampSpeed(next);
		try {
			localStorage.setItem(SPEED_KEY, String(speed));
		} catch {
			/* private mode */
		}
	}

	function onScriptDown(event: PointerEvent) {
		tapX = event.clientX;
		tapY = event.clientY;
	}

	function onScriptTap(event: MouseEvent) {
		if (Math.hypot(event.clientX - tapX, event.clientY - tapY) > 8) return;
		togglePlay();
	}

	function cleanup() {
		if (disposed) return;
		disposed = true;
		window.clearTimeout(countTimer);
	}

	function close() {
		cleanup();
		onclose();
	}

	onMount(() => {
		try {
			speed = clampSpeed(localStorage.getItem(SPEED_KEY));
		} catch {
			/* private mode */
		}
		const onKey = (event: KeyboardEvent) => {
			if (event.key === 'Escape') close();
		};
		window.addEventListener('keydown', onKey);
		beginCountdown();
		return () => {
			window.removeEventListener('keydown', onKey);
			cleanup();
		};
	});

	$effect(() => {
		const node = scroller;
		if (!node) return;
		node.addEventListener('pointerdown', onScriptDown);
		node.addEventListener('click', onScriptTap);
		return () => {
			node.removeEventListener('pointerdown', onScriptDown);
			node.removeEventListener('click', onScriptTap);
		};
	});

	$effect(() => {
		const node = scroller;
		const px = speed;
		if (!node || phase !== 'play' || px <= 0) return;
		let frame = 0;
		let last = performance.now();
		const step = (now: number) => {
			const dt = Math.min(now - last, 48);
			last = now;
			node.scrollTop += (px * dt) / 1000;
			frame = requestAnimationFrame(step);
		};
		frame = requestAnimationFrame(step);
		return () => cancelAnimationFrame(frame);
	});

	$effect(() => {
		if (!playing) return;
		if (!('wakeLock' in navigator)) return;
		let sentinel: WakeLockSentinel | null = null;
		let cancelled = false;
		const arm = () => {
			if (cancelled || document.visibilityState === 'hidden') return;
			navigator.wakeLock
				.request('screen')
				.then((next) => {
					if (cancelled) void next.release().catch(() => undefined);
					else sentinel = next;
				})
				.catch(() => undefined);
		};
		arm();
		document.addEventListener('visibilitychange', arm);
		return () => {
			cancelled = true;
			document.removeEventListener('visibilitychange', arm);
			void sentinel?.release().catch(() => undefined);
		};
	});
</script>

<div class="prompter" class:is-mirror={mirror} role="dialog" aria-modal="true" aria-label="Script">
	<div class="prompter-bar">
		<div class="prompter-row">
			<button class="text-btn" type="button" onclick={close}>Close</button>
			<button class="prompter-icon" type="button" aria-label={phase === 'pause' ? 'Play' : 'Pause'} onclick={togglePlay}>
				{#if phase === 'pause'}
					<svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
						<path d="M6 4.5v9l8-4.5-8-4.5z" fill="currentColor" />
					</svg>
				{:else}
					<svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
						<path d="M5.5 4h2.2v10H5.5zM10.3 4h2.2v10h-2.2z" fill="currentColor" />
					</svg>
				{/if}
			</button>
			<button class="prompter-icon" type="button" aria-label="Restart" onclick={restart}>
				<svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
					<path d="M4 9a5 5 0 1 0 1.2-3.2" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
					<path d="M4 3.5V6.2h2.7" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
				</svg>
			</button>
		</div>
		<div class="prompter-row">
			<button class="prompter-icon prompter-size" type="button" aria-label="Smaller text" disabled={sizeIndex === 0} onclick={() => sizeIndex--}>A−</button>
			<button class="prompter-icon prompter-size" type="button" aria-label="Larger text" disabled={sizeIndex === sizes.length - 1} onclick={() => sizeIndex++}>A+</button>
			<button class="prompter-icon" type="button" aria-pressed={mirror} aria-label="Mirror text" onclick={() => (mirror = !mirror)}>
				<svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
					<path d="M9 3v12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
					<path d="M7 5.5H4.5v7H7M11 5.5h2.5v7H11" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" />
				</svg>
			</button>
			<label class="prompter-speed">
				<span class="visually-hidden">Scroll speed</span>
				<input
					type="range"
					min="16"
					max="120"
					step="1"
					value={speed}
					aria-valuemin="16"
					aria-valuemax="120"
					aria-valuenow={speed}
					aria-label="Scroll speed"
					oninput={(event) => setSpeed(Number(event.currentTarget.value))}
				/>
			</label>
		</div>
	</div>

	<div class="prompter-stage">
		<div class="prompter-guide" aria-hidden="true"></div>
		<div class="prompter-scroll" bind:this={scroller}>
			<div class="prompter-lead"></div>
			<div class="prompter-pad">
				<p class="kicker">{title}</p>
				<p class="prompter-text" style:font-size="{size}px">{text}</p>
			</div>
			<div class="prompter-tail"></div>
		</div>
		{#if phase === 'count'}
			<div class="prompter-count" aria-live="polite">
				{#key count}<b>{count}</b>{/key}
			</div>
		{/if}
	</div>
</div>
