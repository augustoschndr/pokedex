<script lang="ts">
	let { data } = $props();

	function href(kind: 'todo' | 'week', id: string) {
		return kind === 'todo' ? `/you/${encodeURIComponent(id)}` : `/week/${encodeURIComponent(id)}`;
	}
</script>

<svelte:head><title>Plan · Pokedex</title></svelte:head>

<main>
	<div class="toprow">
		<a class="icon-btn" href="/week" aria-label="Back">
			<svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
				<path d="M11 4L6 9l5 5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
			</svg>
		</a>
		<div class="titles">
			<p class="kicker">This week</p>
			<h1>Plan</h1>
		</div>
	</div>

	{#if !data.plan}
		<p class="lede">No plan has been posted yet.</p>
	{:else}
		<p class="lede">{data.plan.done} of {data.plan.total} done</p>
		<div class="stack" style="margin-top: 16px">
			{#each data.plan.phases as phase (phase.id)}
				<article class="card" id="plan-{phase.id}">
					<div class="week-top">
						<h2>{phase.title}</h2>
						<span class="chip">{phase.done} of {phase.total}</span>
					</div>
					{#if phase.detail}<p class="meta" style="margin-top: 6px">{phase.detail}</p>{/if}
					<div class="meter" aria-hidden="true">
						<span style:width="{phase.total ? Math.round((phase.done / phase.total) * 100) : 0}%"></span>
					</div>
					{#if phase.tasks.length}
						<div class="stack" style="margin-top: 12px">
							{#each phase.tasks as task (task.kind + task.id)}
								<a class="plan-task" class:done={task.done} href={href(task.kind, task.id)}>{task.title}</a>
							{/each}
						</div>
					{/if}
					{#each phase.milestones as milestone (milestone.id)}
						<div class="milestone" id="plan-{milestone.id}">
							<div class="week-top">
								<p class="guide-title">{milestone.title}</p>
								<span class="small muted">{milestone.done} of {milestone.total}</span>
							</div>
							{#if milestone.detail}<p class="small" style="margin-top: 4px">{milestone.detail}</p>{/if}
							{#if milestone.tasks.length}
								<div class="stack" style="margin-top: 8px">
									{#each milestone.tasks as task (task.kind + task.id)}
										<a class="plan-task" class:done={task.done} href={href(task.kind, task.id)}>{task.title}</a>
									{/each}
								</div>
							{/if}
						</div>
					{/each}
				</article>
			{/each}
		</div>
	{/if}
</main>
