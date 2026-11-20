<script lang="ts">
	import TaskDetail from '$lib/components/TaskDetail.svelte';

	let { data } = $props();
</script>

<svelte:head><title>{data.task.title} · Pokedex</title></svelte:head>
<TaskDetail task={data.task} />
