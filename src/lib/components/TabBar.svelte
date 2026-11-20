<script lang="ts">
	let { path, pending = 0 }: { path: string; pending?: number } = $props();

	const tabs = [
		{ href: '/today', label: 'Today', icon: 'today' },
		{ href: '/week', label: 'This week', icon: 'week' },
		{ href: '/you', label: 'Only you', icon: 'you' },
		{ href: '/study', label: 'Study', icon: 'study' },
		{ href: '/decisions', label: 'Decisions', icon: 'decide' }
	] as const;
</script>

<nav class="tabbar" aria-label="Sections">
	{#each tabs as tab}
		<a href={tab.href} aria-current={path === tab.href || path.startsWith(`${tab.href}/`) ? 'page' : undefined}>
			<svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
				{#if tab.icon === 'today'}
					<circle cx="12" cy="12" r="7.25" stroke="currentColor" stroke-width="1.5" />
					<path d="M12 8.5V12l2.5 1.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
				{:else if tab.icon === 'week'}
					<rect x="4" y="5" width="16" height="14" rx="2" stroke="currentColor" stroke-width="1.5" />
					<path d="M4 9h16M8 3.5V6M16 3.5V6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
				{:else if tab.icon === 'you'}
					<circle cx="12" cy="12" r="7.25" stroke="currentColor" stroke-width="1.5" />
					<path d="M8.5 12.2l2.3 2.3 4.7-5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
				{:else if tab.icon === 'study'}
					<path d="M5 6.5h6.2c1.2 1.2 1.2 9.8 0 11H5zM19 6.5h-6.2c-1.2 1.2-1.2 9.8 0 11H19z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" />
				{:else}
					<path d="M6 7h12M8 12h8M10 17h4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
				{/if}
			</svg>
			<span class="tab-label">{tab.label}</span>
			{#if tab.href === '/decisions' && pending > 0}
				<span class="tab-dot" aria-label="{pending} waiting"></span>
			{/if}
		</a>
	{/each}
</nav>
