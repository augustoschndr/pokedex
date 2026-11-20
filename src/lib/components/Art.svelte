<script lang="ts">
	let { name }: { name: 'welcome' | 'passkey' | 'bell' | 'home' | 'empty' } = $props();
</script>

<div class="art" aria-hidden="true">
	{#if name === 'welcome'}
		<svg viewBox="0 0 280 210" fill="none">
			<path
				d="M62 148c2-46 34-78 78-78 46 0 80 32 82 72 1 28-22 46-60 50-42 4-98-8-100-44z"
				fill="var(--fill)"
			/>
			<circle cx="198" cy="42" r="13" fill="currentColor" />
			<circle cx="146" cy="72" r="20" stroke="currentColor" stroke-width="1.7" />
			<path d="M128 70c3-20 34-24 40-2" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" />
			<path d="M138 76h.1M156 76h.1" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" />
			<path d="M140 84c3 4 10 4 13 0" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" />
			<path d="M134 94c-4 22 2 40 16 48" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" />
			<path d="M160 94c8 18 6 36-4 48" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" />
			<path d="M140 112c-22 8-34 6-48 18" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" />
			<path d="M164 112c20 6 34 4 46 16" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" />
			<path d="M78 132h52l7 8h22v36H78z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" />
			<path d="M78 148h81" stroke="currentColor" stroke-width="1.7" />
			<path d="M90 160h28M90 170h20" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
			<path d="M132 168c-6 18-16 26-34 28" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" />
			<path d="M158 170c8 16 22 24 40 26" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" />
			<path d="M36 204c36 4 70-6 112 0 36 5 64-2 96 4" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" />
		</svg>
	{:else if name === 'passkey'}
		<svg viewBox="0 0 280 200" fill="none">
			<circle cx="140" cy="96" r="58" stroke="currentColor" stroke-width="1.7" />
			<circle cx="140" cy="96" r="36" stroke="currentColor" stroke-width="1.7" />
			<circle cx="140" cy="96" r="16" stroke="currentColor" stroke-width="1.7" />
			<circle cx="140" cy="96" r="4" fill="currentColor" />
			<path d="M168 118c16 18 22 32 18 48" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" />
			<path d="M176 132c10 2 16 8 18 16" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" />
			<circle cx="206" cy="46" r="10" fill="currentColor" />
		</svg>
	{:else if name === 'bell'}
		<svg viewBox="0 0 280 200" fill="none">
			<path
				d="M140 42c-28 0-46 22-46 48v22c0 10-8 16-18 22h128c-10-6-18-12-18-22V90c0-26-18-48-46-48z"
				stroke="currentColor"
				stroke-width="1.7"
				stroke-linejoin="round"
			/>
			<path d="M126 142c2 12 12 18 28 14" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" />
			<path d="M140 42v-8" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" />
			<path d="M196 58c8-6 14-6 22-2M208 78c8-2 16 0 22 6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
			<circle cx="214" cy="48" r="8" fill="currentColor" />
		</svg>
	{:else if name === 'home'}
		<svg viewBox="0 0 280 210" fill="none">
			<rect x="96" y="28" width="88" height="154" rx="16" stroke="currentColor" stroke-width="1.7" />
			<rect x="104" y="42" width="72" height="104" rx="4" stroke="currentColor" stroke-width="1.4" />
			<circle cx="140" cy="162" r="8" stroke="currentColor" stroke-width="1.6" />
			<path d="M124 78h20M124 92h28M124 106h16" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
			<path d="M48 118h28" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" />
			<path d="M66 108l12 10-12 10" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" />
			<circle cx="214" cy="52" r="11" fill="currentColor" />
		</svg>
	{:else}
		<svg viewBox="0 0 160 80" fill="none">
			<path d="M28 28h46l6 8h36v28H28z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" />
			<path d="M28 44h88" stroke="currentColor" stroke-width="1.6" />
			<circle cx="124" cy="24" r="7" fill="currentColor" />
		</svg>
	{/if}
</div>
