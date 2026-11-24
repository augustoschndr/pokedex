<script lang="ts">
	import { frameStage, phaseLabel } from '$lib/frame';

	let { data } = $props();

	function nextTask(phase: {
		tasks: { title: string; done: boolean }[];
		milestones: { tasks: { title: string; done: boolean }[] }[];
	}) {
		const tasks = [...phase.tasks, ...phase.milestones.flatMap((milestone) => milestone.tasks)];
		return tasks.find((task) => !task.done) ?? null;
	}
</script>

<main>
	<p class="kicker">Operating plan</p>
	<h1>Plan</h1>

	{#if !data.plan}
		<p class="lede">No plan has been posted yet.</p>
	{:else}
		<p class="meta" style="margin-top: 8px">{data.plan.done} of {data.plan.total} done</p>
		<div class="stack" style="margin-top: 16px">
			{#each data.plan.phases as phase (phase.id)}
				{@const next = nextTask(phase)}
				{@const frame = frameStage(phase.title)}
				<a class="card prep-link" href="/plan/{phase.id}">
					<div class="week-top">
						<h2>{frame ? phaseLabel(phase.title) : phase.title}</h2>
						<span class="chip count">{phase.done} of {phase.total}</span>
					</div>
					{#if frame}<div class="chips"><span class="chip">{frame}</span></div>{/if}
					<div class="meter" aria-hidden="true">
						<span style:width="{phase.total ? Math.round((phase.done / phase.total) * 100) : 0}%"></span>
					</div>
					{#if next}<p class="small" style="margin-top: 10px">{next.title}</p>{/if}
				</a>
			{/each}
		</div>
	{/if}
</main>
