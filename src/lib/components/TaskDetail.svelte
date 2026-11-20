<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { onDestroy } from 'svelte';
	import { safeHttpUrl } from '$lib/urls';
	import { scriptReader } from '$lib/script-reader';
	import type { TaskView } from '$lib/server/content';

	let { task }: { task: TaskView } = $props();

	let busy = $state<string | null>(null);
	let error = $state('');

	const guide = $derived(task.guide);
	const script = $derived(guide?.script?.trim() ?? '');

	async function toggleMain() {
		error = '';
		busy = 'main';
		const path = task.kind === 'todo' ? `/api/v1/todos/${encodeURIComponent(task.id)}/toggle` : `/api/v1/week/${encodeURIComponent(task.id)}/toggle`;
		const response = await fetch(path, { method: 'POST' });
		busy = null;
		if (!response.ok) {
			error = 'Could not update that item';
			return;
		}
		await invalidateAll();
	}

	async function toggleCheck(id: string) {
		error = '';
		busy = id;
		const response = await fetch('/api/v1/checklist/toggle', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ parent_kind: task.kind, parent_id: task.id, id })
		});
		busy = null;
		if (!response.ok) {
			error = 'Could not update that step';
			return;
		}
		await invalidateAll();
	}

	onDestroy(() => scriptReader.set(null));
</script>

<main>
	<div class="toprow">
		<a class="icon-btn" href={task.back} aria-label="Back">
			<svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
				<path d="M11 4L6 9l5 5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
			</svg>
		</a>
		<div class="titles">
			<p class="kicker">{task.kind === 'todo' ? 'Only you' : 'This week'}</p>
			<h1>{task.title}</h1>
		</div>
	</div>

	<div class="chips">
		{#if task.lead}<span class="chip">{task.lead}</span>{/if}
		{#if guide?.duration}<span class="chip">{guide.duration}</span>{/if}
		{#if task.status}<span class="chip">{task.status.label}</span>{/if}
		{#if task.meta}<span class="chip">{task.meta}</span>{/if}
	</div>

	<button class="card tick-row" type="button" disabled={busy === 'main'} onclick={toggleMain}>
		<span class="check" aria-hidden="true">
			<i>
				{#if task.done}
					<svg width="14" height="14" viewBox="0 0 14 14">
						<path d="M2.5 7.2l3 3 6-6.5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" />
					</svg>
				{/if}
			</i>
		</span>
		<span class="tick-label">{task.done ? 'Done' : 'Mark done'}</span>
	</button>

	{#if error}<p class="error" role="alert">{error}</p>{/if}
	{#if task.detail}<p class="lede">{task.detail}</p>{/if}
	{#if guide?.summary}<p class="meta" style="margin-top: 12px">{guide.summary}</p>{/if}

	{#if script}
		<button
			class="pill full"
			type="button"
			style="margin-top: 16px"
			onclick={() => scriptReader.set({ title: task.title, text: script })}
		>
			Read the script
		</button>
	{/if}

	{#if guide?.why}
		<section class="section">
			<h2>Why</h2>
			<p class="meta" style="margin-top: 8px">{guide.why}</p>
		</section>
	{/if}

	{#if guide?.steps?.length}
		<section class="section">
			<h2>Steps</h2>
			<ol class="steps">
				{#each guide.steps as step, index}
					<li>
						<span class="step-n" aria-hidden="true">{index + 1}</span>
						<div>
							<p class="guide-title">{step.title}</p>
							{#if step.detail}<p class="small" style="margin-top: 4px">{step.detail}</p>{/if}
						</div>
					</li>
				{/each}
			</ol>
		</section>
	{/if}

	{#if guide?.cut?.length}
		<section class="section">
			<h2>Cut</h2>
			<div class="stack" style="margin-top: 12px">
				{#each guide.cut as cut}
					<article class="card">
						<p class="guide-title">{cut.title}</p>
						{#if cut.detail}<p class="small" style="margin-top: 4px">{cut.detail}</p>{/if}
					</article>
				{/each}
			</div>
		</section>
	{/if}

	{#if guide?.tools?.length}
		<section class="section">
			<h2>Tools</h2>
			<div class="stack" style="margin-top: 12px">
				{#each guide.tools as tool}
					{@const href = tool.url ? safeHttpUrl(tool.url) : null}
					<article class="card">
						{#if href}
							<a class="stretch guide-title" href={href} target="_blank" rel="noopener noreferrer">{tool.name}</a>
						{:else}
							<p class="guide-title">{tool.name}</p>
						{/if}
						{#if tool.note}<p class="small" style="margin-top: 4px">{tool.note}</p>{/if}
					</article>
				{/each}
			</div>
		</section>
	{/if}

	{#if guide?.links?.length}
		<section class="section">
			<h2>Links</h2>
			<div class="stack" style="margin-top: 12px">
				{#each guide.links as link}
					{@const href = safeHttpUrl(link.url)}
					{#if href}
						<a class="card prep-link" href={href} target="_blank" rel="noopener noreferrer">{link.label}</a>
					{/if}
				{/each}
			</div>
		</section>
	{/if}

	{#if task.checklist.length}
		<section class="section">
			<h2>Checklist</h2>
			<div class="card" style="margin-top: 12px">
				{#each task.checklist as item}
					<div class="todo" class:done={item.done}>
						<button
							class="check"
							type="button"
							aria-pressed={item.done}
							aria-label={item.done ? `Mark not done: ${item.text}` : `Mark done: ${item.text}`}
							disabled={busy === item.id}
							onclick={(event) => {
								event.stopPropagation();
								toggleCheck(item.id);
							}}
						>
							<i>
								{#if item.done}
									<svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
										<path d="M2.5 7.2l3 3 6-6.5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" />
									</svg>
								{/if}
							</i>
						</button>
						<p class="todo-copy todo-text">{item.text}</p>
					</div>
				{/each}
			</div>
		</section>
	{/if}

	{#if task.plan}
		<a class="card prep-link" href="/week/plan#plan-{task.plan.id}" style="margin-top: 22px">
			<p class="kicker">{task.plan.kind === 'milestone' ? 'Milestone' : 'Phase'}</p>
			<p class="guide-title" style="margin-top: 4px">{task.plan.title}</p>
		</a>
	{/if}
</main>
