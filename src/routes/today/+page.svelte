<script lang="ts">
	import Diagram from '$lib/components/Diagram.svelte';
	import SettingsLink from '$lib/components/SettingsLink.svelte';

	let { data } = $props();
	const screen = $derived(data.screen);
	const today = $derived(screen?.lesson ?? null);
</script>

<main>
	<div class="toprow">
		<p class="kicker">{screen?.dateLabel ?? 'Today'}</p>
		<SettingsLink />
	</div>

	{#if !screen || screen.mode === 'empty'}
		<h1>No lesson yet</h1>
		<p class="lede">The weekday brief shows up here when it is posted.</p>
	{:else if screen.mode === 'prep'}
		<h1>Prep day</h1>
		<p class="lede">Nothing to film today. The next brief is on its way.</p>
		<article class="card" style="margin-top: 16px">
			<p class="kicker">Next brief</p>
			<p class="countdown">{screen.countdown}</p>
			{#if screen.upcomingTitle}<p class="meta" style="margin-top: 6px">{screen.upcomingTitle}</p>{/if}
		</article>
		<section class="section" style="margin-top: 22px">
			<h2>Start now</h2>
			<div class="stack" style="margin-top: 12px">
				{#if screen.shots.length}
					<a class="card prep-link" href="/week">
						<p class="guide-title">Upcoming shots</p>
						{#each screen.shots as shot}
							<p class="small" style="margin-top: 8px"><span class="lead">{shot.lead}</span> {shot.title}</p>
						{/each}
					</a>
				{/if}
				{#if screen.todoCount}
					<a class="card prep-link" href="/you">
						<p class="guide-title">Only you</p>
						{#each screen.todos as item}
							<p class="small" style="margin-top: 8px">{item.text}</p>
						{/each}
						{#if screen.todoCount > screen.todos.length}
							<p class="small muted" style="margin-top: 8px">{screen.todoCount - screen.todos.length} more</p>
						{/if}
					</a>
				{/if}
				{#if screen.studyCount}
					<a class="card prep-link" href="/study">
						<p class="guide-title">Study</p>
						<p class="small" style="margin-top: 8px">
							{screen.studyHeading ?? 'Notes'} · {screen.studyCount} {screen.studyCount === 1 ? 'note' : 'notes'}
						</p>
					</a>
				{/if}
			</div>
		</section>
	{:else if screen.mode === 'past'}
		<h1>No brief today</h1>
		<p class="lede">The last one was {screen.pastLabel}. Nothing new has been posted for today.</p>
		{#if screen.todoCount || screen.studyCount}
			<section class="section" style="margin-top: 22px">
				<h2>Still open</h2>
				<div class="stack" style="margin-top: 12px">
					{#if screen.todoCount}
						<a class="card prep-link" href="/you">
							<p class="guide-title">Only you</p>
							<p class="small" style="margin-top: 8px">{screen.todoCount} still open</p>
						</a>
					{/if}
					{#if screen.studyCount}
						<a class="card prep-link" href="/study">
							<p class="guide-title">Study</p>
							<p class="small" style="margin-top: 8px">{screen.studyHeading ?? 'Notes'}</p>
						</a>
					{/if}
				</div>
			</section>
		{/if}
	{:else if today}
		<h1>{today.lesson ?? 'Today'}</h1>
		<svg class="underline" viewBox="0 0 72 8" aria-hidden="true">
			<path d="M2 5 C 16 2, 28 7, 40 4 S 60 2, 70 5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
		</svg>
		{#if today.pillar || today.where_it_goes}
			<div class="chips">
				{#if today.pillar}<span class="chip">{today.pillar}</span>{/if}
				{#if today.where_it_goes}<span class="chip">{today.where_it_goes}</span>{/if}
			</div>
		{/if}
		<div class="stack" style="margin-top: 20px">
			{#if today.hook}
				<article class="card fold">
					<svg class="dogear" viewBox="0 0 28 28" aria-hidden="true">
						<path d="M0 0h28L0 28z" fill="var(--bg)" />
						<path d="M0 0h28L0 28" fill="none" stroke="currentColor" stroke-width="1.5" />
					</svg>
					<h2>Hook</h2>
					<p style="margin-top: 8px">{today.hook}</p>
				</article>
			{/if}
			{#if today.talking_points.length}
				<article class="card">
					<h2>Talking points</h2>
					<ol class="points">
						{#each today.talking_points as point}<li>{point}</li>{/each}
					</ol>
				</article>
			{/if}
			{#if today.whiteboard}
				<article class="card">
					<h2>Whiteboard</h2>
					<div style="margin-top: 12px"><Diagram diagram={today.whiteboard} /></div>
				</article>
			{/if}
			{#if today.cta}
				<article class="card">
					<h2>Close</h2>
					<p style="margin-top: 8px">{today.cta}</p>
				</article>
			{/if}
			{#if today.body}
				<article class="card">
					<h2>Notes</h2>
					<p class="meta" style="margin-top: 8px">{today.body}</p>
				</article>
			{/if}
		</div>
	{/if}
</main>
