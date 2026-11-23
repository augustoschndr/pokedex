<script lang="ts">
	import { browser } from '$app/environment';
	import '@fontsource/instrument-sans/400.css';
	import '@fontsource/instrument-sans/500.css';
	import '@fontsource/instrument-sans/600.css';
	import '@fontsource/bricolage-grotesque/600.css';
	import '../app.css';
	import AppShell from '$lib/components/AppShell.svelte';
	import Teleprompter from '$lib/components/Teleprompter.svelte';
	import { scriptReader } from '$lib/script-reader';
	import {
		appleTouchHref,
		faviconDarkHref,
		faviconHref,
		iconSvgDarkHref,
		iconSvgHref,
		manifestHref
	} from '$lib/icons';
	import { page } from '$app/state';
	import { showsTabs } from '$lib/tabs';
	import { ensurePushSubscription } from '$lib/push';
	import { applyTheme } from '$lib/theme';
	import { onMount } from 'svelte';

	let { data, children } = $props();
	const path = $derived(page.url.pathname);
	const showTabs = $derived(Boolean(data.user && data.tabs && showsTabs(path)));

	$effect(() => {
		if (!browser) return;
		applyTheme(data.theme);
		if (data.theme !== 'system') return;
		const media = window.matchMedia('(prefers-color-scheme: dark)');
		const onChange = () => applyTheme('system');
		media.addEventListener('change', onChange);
		return () => media.removeEventListener('change', onChange);
	});

	function dismissBoot() {
		const boot = document.getElementById('boot');
		if (!boot || boot.dataset.done === '1') return;
		const hold = new URLSearchParams(location.search).has('splash');
		if (document.documentElement.dataset.splash === 'skip' && !hold) {
			boot.dataset.done = '1';
			boot.remove();
			return;
		}
		if (hold) {
			boot.dataset.ready = '1';
			return;
		}
		boot.dataset.done = '1';
		let gone = false;
		const go = () => {
			if (gone) return;
			gone = true;
			boot.classList.add('is-out');
			const remove = () => {
				if (boot.isConnected) boot.remove();
			};
			boot.addEventListener('transitionend', remove, { once: true });
			window.setTimeout(remove, 400);
		};
		const cap = window.setTimeout(go, 2500);
		requestAnimationFrame(() => {
			window.clearTimeout(cap);
			go();
		});
	}

	onMount(() => {
		dismissBoot();
		if (!('serviceWorker' in navigator)) return;
		const registered = navigator.serviceWorker.register('/service-worker.js').catch(() => undefined);
		if (!data.user || !data.vapidPublicKey) return;
		const sync = () => ensurePushSubscription(data.vapidPublicKey);
		void registered.then(() => sync());
		navigator.serviceWorker.addEventListener('controllerchange', sync);
		return () => navigator.serviceWorker.removeEventListener('controllerchange', sync);
	});
</script>

<svelte:head>
	<link rel="apple-touch-icon" href={appleTouchHref} sizes="180x180" />
	<link rel="icon" href={faviconHref} type="image/png" sizes="32x32" />
	<link
		rel="icon"
		href={faviconDarkHref}
		type="image/png"
		sizes="32x32"
		media="(prefers-color-scheme: dark)"
	/>
	<link rel="icon" href={iconSvgHref} type="image/svg+xml" />
	<link rel="icon" href={iconSvgDarkHref} type="image/svg+xml" media="(prefers-color-scheme: dark)" />
	<link rel="manifest" href={manifestHref} />
</svelte:head>

{#if showTabs && data.tabs}
	<AppShell path={path} pending={data.pendingDecisions} tabs={data.tabs}>
		{@render children()}
	</AppShell>
{:else}
	{@render children()}
{/if}

{#if $scriptReader}
	<Teleprompter
		title={$scriptReader.title}
		text={$scriptReader.text}
		onclose={() => scriptReader.set(null)}
	/>
{/if}
