<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import DecisionsPage from '../../routes/decisions/+page.svelte';
	import StudyPage from '../../routes/study/+page.svelte';
	import TodayPage from '../../routes/today/+page.svelte';
	import WeekPage from '../../routes/week/+page.svelte';
	import YouPage from '../../routes/you/+page.svelte';
	import {
		aimedVelocity,
		commitDirection,
		follow,
		isTab,
		stepSpring,
		TAB_HREFS,
		tabIndex,
		type TabHref
	} from '$lib/tabs';
	import TabBar from './TabBar.svelte';

	let {
		path,
		pending = 0,
		tabs,
		children
	}: {
		path: string;
		pending?: number;
		tabs: {
			today: { screen: unknown };
			week: Record<string, unknown>;
			you: { intro: string; items: unknown[] };
			study: { study: unknown; reels_rules: unknown };
			decisions: { decisions: unknown[] };
		};
		children: import('svelte').Snippet;
	} = $props();

	const titles: Record<TabHref, string> = {
		'/today': 'Today',
		'/week': 'This week',
		'/you': 'Only you',
		'/study': 'Study',
		'/decisions': 'Decisions'
	};

	let shell = $state<HTMLDivElement | null>(null);
	let parked = $state<number | null>(null);
	let offset = $state(0);
	let dragging = $state(false);
	let animating = $state(false);
	let pathNow = $state('');

	const shown = $derived(parked ?? Math.max(0, tabIndex(path)));
	const onTab = $derived(isTab(path));
	const moving = $derived(dragging || animating);
	const barPath = $derived(onTab ? (TAB_HREFS[shown] ?? path) : path);
	const title = $derived(isTab(path) ? titles[path] : '');

	$effect(() => {
		pathNow = path;
	});

	$effect(() => {
		if (parked !== null && tabIndex(path) === parked) parked = null;
	});

	function reduced() {
		return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	}

	function runSpring(target: number, velocity: number) {
		return new Promise<void>((resolve) => {
			let speed = velocity;
			let last = performance.now();
			const started = last;
			const frame = (now: number) => {
				if (now - started > 900) {
					offset = target;
					resolve();
					return;
				}
				const step = stepSpring(offset, target, speed, Math.min(0.032, (now - last) / 1000));
				last = now;
				offset = step.offset;
				speed = step.velocity;
				if (step.settled) resolve();
				else requestAnimationFrame(frame);
			};
			requestAnimationFrame(frame);
		});
	}

	function go(href: string) {
		return goto(href, { noScroll: true, keepFocus: true, invalidateAll: false });
	}

	async function settle(target: number, velocity: number, href: TabHref | null) {
		if (href && reduced()) {
			parked = TAB_HREFS.indexOf(href);
			offset = 0;
			dragging = false;
			animating = false;
			try {
				await go(href);
			} catch {
				parked = null;
				offset = 0;
			}
			return;
		}
		animating = true;
		dragging = false;
		if (reduced()) offset = target;
		else await runSpring(target, velocity);
		if (!href) {
			offset = 0;
			animating = false;
			return;
		}
		parked = TAB_HREFS.indexOf(href);
		offset = 0;
		animating = false;
		try {
			await go(href);
		} catch {
			parked = null;
			offset = 0;
		}
	}

	async function travelTo(href: string) {
		if (animating || href === pathNow) return;
		if (!isTab(pathNow) || !isTab(href) || !shell) {
			await go(href);
			return;
		}
		const from = TAB_HREFS.indexOf(pathNow);
		const to = TAB_HREFS.indexOf(href);
		const width = shell.clientWidth || window.innerWidth;
		await settle((from - to) * width, 0, href);
	}

	onMount(() => {
		const node = shell;
		if (!node) return;

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
		let queued = 0;

		const skipTarget = (target: EventTarget | null) =>
			target instanceof Element &&
			Boolean(target.closest('input, textarea, select, [contenteditable="true"], .tabbar'));

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

		function paint(next: number) {
			rawX = next;
			if (queued) return;
			queued = requestAnimationFrame(() => {
				queued = 0;
				const width = node?.clientWidth || window.innerWidth;
				const index = TAB_HREFS.indexOf(pathNow as TabHref);
				offset = follow(rawX, width, index <= 0, index === TAB_HREFS.length - 1);
			});
		}

		function onMove(event: PointerEvent) {
			if (!node || !active || event.pointerId !== pointerId) return;
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
				node.setPointerCapture(event.pointerId);
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
			paint(dx);
		}

		async function finish(event: PointerEvent, cancel: boolean) {
			if (!node || !active || event.pointerId !== pointerId) return;
			const wasX = locked === 'x';
			const goBack = edgeBack && !cancel;
			active = false;
			locked = null;
			edgeBack = false;
			if (queued) {
				cancelAnimationFrame(queued);
				queued = 0;
				const width = node.clientWidth || window.innerWidth;
				const index = TAB_HREFS.indexOf(pathNow as TabHref);
				offset = follow(rawX, width, index <= 0, index === TAB_HREFS.length - 1);
			}
			if (goBack) {
				dragging = false;
				history.back();
				return;
			}
			if (!wasX || !isTab(pathNow)) {
				dragging = false;
				return;
			}
			suppressClick = true;
			window.setTimeout(() => {
				suppressClick = false;
			}, 400);
			const width = node.clientWidth || window.innerWidth;
			const dir = cancel ? 0 : commitDirection(rawX, width, velocity);
			const href = dir === 0 ? null : (TAB_HREFS[TAB_HREFS.indexOf(pathNow) + dir] ?? null);
			const target = href ? (dir === 1 ? -width : width) : 0;
			await settle(target, aimedVelocity(offset, target, velocity), href);
		}

		function onClickCapture(event: Event) {
			if (!suppressClick) return;
			suppressClick = false;
			event.preventDefault();
			event.stopPropagation();
		}

		function onLinkClick(event: MouseEvent) {
			if (
				event.defaultPrevented ||
				event.button !== 0 ||
				event.metaKey ||
				event.ctrlKey ||
				event.shiftKey ||
				event.altKey
			) {
				return;
			}
			const anchor = event.target instanceof Element ? event.target.closest('a') : null;
			if (!anchor || anchor.target || anchor.hasAttribute('download')) return;
			const url = new URL(anchor.href, location.origin);
			if (url.origin !== location.origin) return;
			if (!isTab(url.pathname) || url.pathname === pathNow || !isTab(pathNow)) return;
			event.preventDefault();
			void travelTo(url.pathname);
		}

		function onEdge(event: TouchEvent) {
			const touch = event.touches[0];
			if (!touch || touch.clientX > 28) return;
			if (event.target instanceof Element && event.target.closest('a, button, input, textarea, select')) return;
			event.preventDefault();
		}

		const onUp = (event: PointerEvent) => void finish(event, false);
		const onCancel = (event: PointerEvent) => void finish(event, true);
		node.addEventListener('pointerdown', onDown);
		node.addEventListener('pointermove', onMove, { passive: false });
		node.addEventListener('pointerup', onUp);
		node.addEventListener('pointercancel', onCancel);
		node.addEventListener('click', onClickCapture, true);
		node.addEventListener('click', onLinkClick);
		node.addEventListener('touchstart', onEdge, { passive: false });

		return () => {
			node.removeEventListener('pointerdown', onDown);
			node.removeEventListener('pointermove', onMove);
			node.removeEventListener('pointerup', onUp);
			node.removeEventListener('pointercancel', onCancel);
			node.removeEventListener('click', onClickCapture, true);
			node.removeEventListener('click', onLinkClick);
			node.removeEventListener('touchstart', onEdge);
			if (queued) cancelAnimationFrame(queued);
		};
	});
</script>

<svelte:head>
	{#if title}<title>{title} · Pokedex</title>{/if}
</svelte:head>

<div class="app-shell" bind:this={shell}>
	<div class="stage">
		<div
			class="pager"
			class:is-moving={moving}
			class:is-covered={!onTab}
			style:transform="translate3d(calc({shown} * -100% + {offset}px), 0, 0)"
			inert={!onTab}
			aria-hidden={!onTab}
		>
			{#each TAB_HREFS as href, i (href)}
				<div
					class="pane"
					class:is-active={onTab && i === shown}
					inert={onTab ? i !== shown && !moving : true}
					aria-hidden={onTab ? i !== shown && !moving : true}
				>
					{#if href === '/today'}
						<TodayPage data={tabs.today as never} />
					{:else if href === '/week'}
						<WeekPage data={tabs.week as never} />
					{:else if href === '/you'}
						<YouPage data={tabs.you as never} />
					{:else if href === '/study'}
						<StudyPage data={tabs.study as never} />
					{:else}
						<DecisionsPage data={tabs.decisions as never} />
					{/if}
				</div>
			{/each}
		</div>
		{#if !onTab}
			<div class="pane is-active detail">
				{@render children()}
			</div>
		{/if}
	</div>
	<TabBar path={barPath} pending={pending} />
</div>
