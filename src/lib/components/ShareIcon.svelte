<script lang="ts">
	let { size = 48 }: { size?: number } = $props();
</script>

<svg class="share-icon" width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden="true">
	<path d="M24 30.2V11.2" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" />
	<path
		d="M16.8 18.2 24 10.4l7.4 7.7"
		stroke="currentColor"
		stroke-width="1.7"
		stroke-linecap="round"
		stroke-linejoin="round"
	/>
	<path
		d="M16.4 21.2h-4.2c-1.2 0-2.3 1.1-2.2 2.4v15.2c0 1.3 1.1 2.4 2.4 2.3h23.2c1.3 0 2.4-1.1 2.3-2.4V23.6c0-1.3-1.1-2.4-2.4-2.4H31.6"
		stroke="currentColor"
		stroke-width="1.7"
		stroke-linecap="round"
		stroke-linejoin="round"
	/>
</svg>
