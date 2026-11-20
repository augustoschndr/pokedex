<script lang="ts">
	import { browser } from '$app/environment';
	import '@fontsource/instrument-sans/400.css';
	import '@fontsource/instrument-sans/500.css';
	import '@fontsource/instrument-sans/600.css';
	import '@fontsource/bricolage-grotesque/600.css';
	import '../app.css';
	import TabBar from '$lib/components/TabBar.svelte';
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

{#if data.showTabs}
	<div class="app-scroll">
		{@render children()}
	</div>
	<TabBar path={data.path} pending={data.pendingDecisions} />
{:else}
	{@render children()}
{/if}
