<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { commitDirection, follow, isTab, neighbor, TAB_HREFS } from '$lib/tabs';
	import TabBar from './TabBar.svelte';

	let { path, pending = 0, children } = $props();

	let scroller = $state<HTMLDivElement | null>(null);
	let dragX = $state(0);
	let dragging = $state(false);
	let animating = $state(false);
	let pathNow = $state('');

	$effect(() => {
		pathNow = path;
	});

	let transform = $derived(dragX === 0 && !animating ? 'none' : `translate3d(${dragX}px,0,0)`);

	function reduced() {
		return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	}

	function frames(count = 1) {
		return new Promise<void>((resolve) => {
			let left = count;
			const step = () => {
				left -= 1;
				if (left <= 0) resolve();
				else requestAnimationFrame(step);
			};
			requestAnimationFrame(step);
		});
	}

	function waitTransition(node: HTMLElement) {
		return new Promise<void>((resolve) => {
			let settled = false;
			const finish = () => {
				if (settled) return;
				settled = true;
				node.removeEventListener('transitionend', onEnd);
				resolve();
			};
			const onEnd = (event: TransitionEvent) => {
				if (event.target === node && event.propertyName === 'transform') finish();
			};
			node.addEventListener('transitionend', onEnd);
			window.setTimeout(finish, 420);
		});
	}

	function layer() {
		return scroller?.querySelector('.page-layer') ?? null;
	}

	async function slideTo(href: string) {
		if (animating || href === pathNow) return;
		const from = TAB_HREFS.indexOf(pathNow as (typeof TAB_HREFS)[number]);
		const to = TAB_HREFS.indexOf(href as (typeof TAB_HREFS)[number]);
		const node = layer();
		const width = scroller?.clientWidth || window.innerWidth;
		if (from < 0 || to < 0 || reduced() || !(node instanceof HTMLElement)) {
			dragX = 0;
			dragging = false;
			animating = false;
			await goto(href);
			return;
		}
		const dir = Math.sign(to - from);
		animating = true;
		await frames(1);
		dragX = dir > 0 ? -width : width;
		await waitTransition(node);
		try {
			await goto(href);
		} catch {
			animating = false;
			dragX = 0;
			return;
		}
		animating = false;
		dragX = dir > 0 ? width : -width;
		await frames(2);
		animating = true;
		await frames(1);
		dragX = 0;
		await waitTransition(node);
		animating = false;
		dragX = 0;
	}

	onMount(() => {
		const scrollEl = scroller;
		if (!scrollEl) return;

		let pointerId = -1;
		let startX = 0;
		let startY = 0;
		let lastX = 0;
		let lastT = 0;
		let velocity = 0;
		let rawX = 0;
		let locked: 'x' | 'y' | null = null;
		let active = false;
		let suppressClick = false;
		let edgeBack = false;

		const skipTarget = (target: EventTarget | null) =>
			target instanceof Element &&
			Boolean(target.closest('input, textarea, select, [contenteditable="true"]'));

		function onDown(event: PointerEvent) {
			if (animating || event.button !== 0 || skipTarget(event.target)) return;
			pointerId = event.pointerId;
			startX = lastX = event.clientX;
			startY = event.clientY;
			lastT = performance.now();
			velocity = 0;
			rawX = 0;
			locked = null;
			active = true;
			edgeBack = false;
		}

		function onMove(event: PointerEvent) {
			if (!scrollEl || !active || event.pointerId !== pointerId) return;
			const dx = event.clientX - startX;
			const dy = event.clientY - startY;
			if (!locked) {
				if (Math.hypot(dx, dy) < 10) return;
				locked = Math.abs(dx) > Math.abs(dy) * 1.15 ? 'x' : 'y';
				if (locked === 'y') {
					active = false;
					return;
				}
				if (!isTab(pathNow)) {
					if (startX <= 32 && dx >= 72) edgeBack = true;
					return;
				}
				scrollEl.setPointerCapture(event.pointerId);
				dragging = true;
			}
			if (!isTab(pathNow)) {
				if (startX <= 32 && dx >= 72) edgeBack = true;
				return;
			}
			if (locked !== 'x') return;
			event.preventDefault();
			const now = performance.now();
			const dt = now - lastT;
			if (dt > 0) velocity = (event.clientX - lastX) / dt;
			lastX = event.clientX;
			lastT = now;
			rawX = dx;
			const index = TAB_HREFS.indexOf(pathNow as (typeof TAB_HREFS)[number]);
			dragX = follow(dx, scrollEl.clientWidth, index <= 0, index === TAB_HREFS.length - 1);
		}

		async function finish(event: PointerEvent, cancel: boolean) {
			if (!scrollEl || !active || event.pointerId !== pointerId) return;
			const wasX = locked === 'x';
			const goBack = edgeBack && !cancel;
			active = false;
			locked = null;
			dragging = false;
			edgeBack = false;
			if (goBack) {
				history.back();
				return;
			}
			if (!wasX || !isTab(pathNow)) return;
			suppressClick = true;
			window.setTimeout(() => {
				suppressClick = false;
			}, 400);
			const node = layer();
			const dir = cancel ? 0 : commitDirection(rawX, scrollEl.clientWidth, velocity);
			const href = dir === 0 ? null : neighbor(pathNow, dir);
			if (!href || !(node instanceof HTMLElement)) {
				animating = true;
				await frames(1);
				dragX = 0;
				if (node instanceof HTMLElement && !reduced()) await waitTransition(node);
				animating = false;
				dragX = 0;
				return;
			}
			await slideTo(href);
		}

		function onClick(event: Event) {
			if (!suppressClick) return;
			suppressClick = false;
			event.preventDefault();
			event.stopPropagation();
		}

		function onTabClick(event: Event) {
			if (animating) return;
			const anchor = event.target instanceof Element ? event.target.closest('a') : null;
			if (!anchor) return;
			const href = new URL(anchor.getAttribute('href') || '', location.origin).pathname;
			if (!isTab(href) || href === pathNow) return;
			event.preventDefault();
			void slideTo(href);
		}

		const onUp = (event: PointerEvent) => void finish(event, false);
		const onCancel = (event: PointerEvent) => void finish(event, true);
		scrollEl.addEventListener('pointerdown', onDown);
		scrollEl.addEventListener('pointermove', onMove, { passive: false });
		scrollEl.addEventListener('pointerup', onUp);
		scrollEl.addEventListener('pointercancel', onCancel);
		scrollEl.addEventListener('click', onClick, true);
		const bar = scrollEl.parentElement?.querySelector<HTMLElement>('.tabbar');
		bar?.addEventListener('click', onTabClick, true);

		return () => {
			scrollEl.removeEventListener('pointerdown', onDown);
			scrollEl.removeEventListener('pointermove', onMove);
			scrollEl.removeEventListener('pointerup', onUp);
			scrollEl.removeEventListener('pointercancel', onCancel);
			scrollEl.removeEventListener('click', onClick, true);
			bar?.removeEventListener('click', onTabClick, true);
		};
	});
</script>

<div class="app-shell">
	<div class="app-scroll" bind:this={scroller}>
		<div
			class="page-layer"
			class:is-dragging={dragging}
			class:is-anim={animating}
			style:transform={transform}
		>
			{@render children()}
		</div>
	</div>
	<TabBar {path} {pending} />
</div>
