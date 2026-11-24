<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { onDestroy } from 'svelte';
	import { takeCheckPress } from '$lib/check-press';
	import { createToggleQueue } from '$lib/toggle-queue';
	import { safeHttpUrl } from '$lib/urls';
	import { scriptReader } from '$lib/script-reader';
	import Tags from '$lib/components/Tags.svelte';
	import type { TaskView } from '$lib/server/content';

	let { task }: { task: TaskView } = $props();

	let mainOverride = $state<boolean | null>(null);
	let checkOverrides = $state<Record<string, boolean>>({});
	let drafts = $state<Record<number, string>>({});
	let saved = $state<Record<number, string>>({});
	let draftKey = $state('');
	let error = $state('');
	const noteTimers = new Map<number, ReturnType<typeof setTimeout>>();
	const noteGen = new Map<number, number>();

	const guide = $derived(task.guide);
	const script = $derived(guide?.script?.trim() ?? '');
	const done = $derived(mainOverride ?? task.done);

	const mainQueue = createToggleQueue({
		onFail: () => {
			mainOverride = null;
			error = 'Could not update that item';
		},
		onIdle: async () => {
			await invalidateAll();
			if (mainOverride !== null && mainOverride === task.done) mainOverride = null;
		}
	});

	const checkQueues = new Map<string, (post: () => Promise<boolean>) => void>();

	function stepDone(id: string, value: boolean) {
		return id in checkOverrides ? checkOverrides[id] : value;
	}

	function queueForStep(id: string) {
		const existing = checkQueues.get(id);
		if (existing) return existing;
		const queue = createToggleQueue({
			onFail: () => {
				delete checkOverrides[id];
				error = 'Could not update that step';
			},
			onIdle: async () => {
				await invalidateAll();
				const item = task.checklist.find((row) => row.id === id);
				if (item && id in checkOverrides && checkOverrides[id] === item.done) delete checkOverrides[id];
			}
		});
		checkQueues.set(id, queue);
		return queue;
	}

	function flipMain() {
		error = '';
		const next = !done;
		mainOverride = next;
		const path =
			task.kind === 'todo'
				? `/api/v1/todos/${encodeURIComponent(task.id)}/toggle`
				: `/api/v1/week/${encodeURIComponent(task.id)}/toggle`;
		mainQueue(async () => {
			const response = await fetch(path, { method: 'POST' });
			return response.ok;
		});
	}

	function savedNote(index: number) {
		if (index in saved) return saved[index];
		return task.stepNotes.find((note) => note.index === index)?.text ?? '';
	}

	function noteValue(index: number) {
		return index in drafts ? drafts[index] : savedNote(index);
	}

	function noteChanged(index: number, value: string) {
		drafts[index] = value;
		const pending = noteTimers.get(index);
		if (pending) clearTimeout(pending);
		noteTimers.set(
			index,
			setTimeout(() => {
				noteTimers.delete(index);
				void saveNote(index, value);
			}, 400)
		);
	}

	function noteBlur(index: number, value: string) {
		const pending = noteTimers.get(index);
		if (pending) clearTimeout(pending);
		noteTimers.delete(index);
		void saveNote(index, value);
	}

	async function saveNote(index: number, value: string) {
		if (value.trim() === savedNote(index)) return;
		const gen = (noteGen.get(index) ?? 0) + 1;
		noteGen.set(index, gen);
		error = '';
		const response = await fetch('/api/v1/steps/comment', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ parent_kind: task.kind, parent_id: task.id, index, text: value })
		});
		if (noteGen.get(index) !== gen) return;
		if (!response.ok) {
			error = 'Could not save that comment';
			return;
		}
		saved[index] = value.trim();
	}

	function flipStep(id: string, value: boolean) {
		error = '';
		checkOverrides[id] = !stepDone(id, value);
		queueForStep(id)(async () => {
			const response = await fetch('/api/v1/checklist/toggle', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ parent_kind: task.kind, parent_id: task.id, id })
			});
			return response.ok;
		});
	}

	$effect(() => {
		const key = `${task.kind}:${task.id}`;
		if (key === draftKey) return;
		draftKey = key;
		drafts = {};
		saved = {};
		for (const timer of noteTimers.values()) clearTimeout(timer);
		noteTimers.clear();
	});

	onDestroy(() => {
		for (const timer of noteTimers.values()) clearTimeout(timer);
		scriptReader.set(null);
	});
</script>

<main>
	<a class="back-btn" href={task.back}>
		<svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
			<path d="M11 4L6 9l5 5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
		</svg>
		Back
	</a>
	<div class="titles">
		<p class="kicker">{task.kind === 'todo' ? 'Only you' : 'This week'}</p>
		<h1>{task.title}</h1>
	</div>

	<Tags phase={task.plan?.phaseTitle} frame={task.plan?.frame} />
	<div class="chips">
		{#if task.lead}<span class="chip">{task.lead}</span>{/if}
		{#if guide?.duration}<span class="chip">{guide.duration}</span>{/if}
		{#if task.status}<span class="chip">{task.status.label}</span>{/if}
		{#if task.meta}<span class="chip">{task.meta}</span>{/if}
	</div>

	<button
		class="card tick-row"
		type="button"
		aria-pressed={done}
		onpointerdown={(event) => {
			if (takeCheckPress(event)) flipMain();
		}}
		onclick={(event) => {
			if (takeCheckPress(event)) flipMain();
		}}
	>
		<span class="check" aria-hidden="true">
			<i>
				{#if done}
					<svg width="14" height="14" viewBox="0 0 14 14">
						<path d="M2.5 7.2l3 3 6-6.5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" />
					</svg>
				{/if}
			</i>
		</span>
		<span class="tick-label">{done ? 'Done' : 'Mark done'}</span>
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
						<div class="step-body">
							<p class="guide-title">{step.title}</p>
							{#if step.detail}<p class="small" style="margin-top: 4px">{step.detail}</p>{/if}
							<input
								class="field step-note"
								type="text"
								maxlength="2000"
								autocomplete="off"
								enterkeyhint="done"
								placeholder="Comment"
								aria-label={`Comment on ${step.title}`}
								value={noteValue(index)}
								oninput={(event) => noteChanged(index, event.currentTarget.value)}
								onblur={(event) => noteBlur(index, event.currentTarget.value)}
							/>
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
					<div class="todo" class:done={stepDone(item.id, item.done)}>
						<button
							class="check"
							type="button"
							aria-pressed={stepDone(item.id, item.done)}
							aria-label={stepDone(item.id, item.done) ? `Mark not done: ${item.text}` : `Mark done: ${item.text}`}
							onpointerdown={(event) => {
								if (takeCheckPress(event)) flipStep(item.id, item.done);
							}}
							onclick={(event) => {
								if (takeCheckPress(event)) flipStep(item.id, item.done);
							}}
						>
							<i>
								{#if stepDone(item.id, item.done)}
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
		<a class="card prep-link" href="/plan/{task.plan.phaseId}#plan-{task.plan.id}" style="margin-top: 22px">
			<p class="kicker">{task.plan.kind === 'milestone' ? 'Milestone' : 'Phase'}</p>
			<p class="guide-title" style="margin-top: 4px">{task.plan.title}</p>
		</a>
	{/if}
</main>
