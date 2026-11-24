<script lang="ts">
	import Tags from '$lib/components/Tags.svelte';
	import { frameStage, phaseLabel } from '$lib/frame';
	import type { PlanPhaseView } from '$lib/server/content';

	let { phase }: { phase: PlanPhaseView } = $props();
	const frame = $derived(frameStage(phase.title));

	function href(kind: 'todo' | 'week', id: string) {
		return kind === 'todo' ? `/you/${encodeURIComponent(id)}` : `/week/${encodeURIComponent(id)}`;
	}
</script>

<article class="card" id="plan-{phase.id}">
	<div class="week-top">
		<h2>{frame ? phaseLabel(phase.title) : phase.title}</h2>
		<span class="chip count">{phase.done} of {phase.total}</span>
	</div>
	{#if phase.detail}<p class="meta" style="margin-top: 6px">{phase.detail}</p>{/if}
	<div class="meter" aria-hidden="true">
		<span style:width="{phase.total ? Math.round((phase.done / phase.total) * 100) : 0}%"></span>
	</div>
	{#if phase.tasks.length}
		<div class="stack" style="margin-top: 12px">
			{#each phase.tasks as task (task.kind + task.id)}
				<div class="plan-row">
					<a class="plan-task" class:done={task.done} href={href(task.kind, task.id)}>{task.title}</a>
					<Tags phase={task.phase} frame={task.frame} />
				</div>
			{/each}
		</div>
	{/if}
	{#each phase.milestones as milestone (milestone.id)}
		<div class="milestone" id="plan-{milestone.id}">
			<div class="week-top">
				<p class="guide-title">{milestone.title}</p>
				<span class="small muted count">{milestone.done} of {milestone.total}</span>
			</div>
			{#if milestone.detail}<p class="small" style="margin-top: 4px">{milestone.detail}</p>{/if}
			{#if milestone.tasks.length}
				<div class="stack" style="margin-top: 8px">
					{#each milestone.tasks as task (task.kind + task.id)}
						<div class="plan-row">
							<a class="plan-task" class:done={task.done} href={href(task.kind, task.id)}>{task.title}</a>
							<Tags phase={task.phase} frame={task.frame} />
						</div>
					{/each}
				</div>
			{/if}
		</div>
	{/each}
</article>
