<script lang="ts">
	import { browser } from '$app/environment';
	import '@fontsource/instrument-sans/400.css';
	import '@fontsource/instrument-sans/500.css';
	import '@fontsource/instrument-sans/600.css';
	import '@fontsource/bricolage-grotesque/600.css';
	import '../app.css';
	import AppShell from '$lib/components/AppShell.svelte';
	import Splash from '$lib/components/Splash.svelte';
	import {
		appleTouchHref,
		faviconDarkHref,
		faviconHref,
		iconSvgDarkHref,
		iconSvgHref,
		manifestHref
	} from '$lib/icons';
	import { applyTheme } from '$lib/theme';
	import { onMount } from 'svelte';

	let { data, children } = $props();

	$effect(() => {
		if (!browser) return;
		applyTheme(data.theme);
		if (data.theme !== 'system') return;
		const media = window.matchMedia('(prefers-color-scheme: dark)');
		const onChange = () => applyTheme('system');
		media.addEventListener('change', onChange);
		return () => media.removeEventListener('change', onChange);
	});

	onMount(() => {
		if ('serviceWorker' in navigator) {
			navigator.serviceWorker.register('/service-worker.js').catch(() => {});
		}
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

{#if data.showTabs}
	<AppShell path={data.path} pending={data.pendingDecisions}>
		{@render children()}
	</AppShell>
	<Splash />
{:else}
	{@render children()}
{/if}
