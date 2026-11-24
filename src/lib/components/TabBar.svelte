<script lang="ts">
	let { path, pending = 0 }: { path: string; pending?: number } = $props();

	const tabs = [
		{ href: '/today', label: 'Today', icon: 'today' },
		{ href: '/week', label: 'Week', icon: 'week' },
		{ href: '/plan', label: 'Plan', icon: 'plan' },
		{ href: '/more', label: 'More', icon: 'more' }
	] as const;
</script>

<nav class="tabbar" aria-label="Sections">
	{#each tabs as tab}
		<a href={tab.href} aria-current={path === tab.href || path.startsWith(`${tab.href}/`) ? 'page' : undefined}>
			<svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
				{#if tab.icon === 'today'}
					<circle cx="12" cy="12" r="7.25" stroke="currentColor" stroke-width="1.5" />
					<path d="M12 8.5V12l2.5 1.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
				{:else if tab.icon === 'week'}
					<rect x="4" y="5" width="16" height="14" rx="2" stroke="currentColor" stroke-width="1.5" />
					<path d="M4 9h16M8 3.5V6M16 3.5V6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
				{:else if tab.icon === 'plan'}
					<circle cx="7" cy="8" r="2" stroke="currentColor" stroke-width="1.5" />
					<circle cx="16.5" cy="7" r="2" stroke="currentColor" stroke-width="1.5" />
					<circle cx="12" cy="16.5" r="2" stroke="currentColor" stroke-width="1.5" />
					<path d="M8.8 8.8l5.6-.8M15.2 8.7l-2.2 5.6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
				{:else}
					<circle cx="6" cy="12" r="1.35" stroke="currentColor" stroke-width="1.5" />
					<circle cx="12" cy="12" r="1.35" stroke="currentColor" stroke-width="1.5" />
					<circle cx="18" cy="12" r="1.35" stroke="currentColor" stroke-width="1.5" />
				{/if}
			</svg>
			<span class="visually-hidden">{tab.label}</span>
			{#if tab.href === '/today' && pending > 0}
				<span class="tab-dot" aria-label="{pending} waiting"></span>
			{/if}
		</a>
	{/each}
</nav>
