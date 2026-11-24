<script lang="ts">
	import { onDestroy } from 'svelte';
	import DecisionCard from '$lib/components/DecisionCard.svelte';
	import Tags from '$lib/components/Tags.svelte';
	import { scriptReader } from '$lib/script-reader';

	let { data } = $props();
	const screen = $derived(data.screen);
	const focus = $derived(screen?.focus ?? null);

	onDestroy(() => scriptReader.set(null));
</script>

<main>
	<p class="kicker">{screen?.dateLabel ?? 'Today'}</p>
	{#if screen?.lesson && !focus?.title?.includes(screen.lesson)}
		<p class="meta" style="margin-top: 4px">{screen.lesson}</p>
	{/if}

	{#if focus}
		{@const item = focus}
		{#if item.when !== 'today'}
			<p class="kicker">Up next · {item.dateLabel}</p>
		{/if}
		<h1>{item.title}</h1>
		<svg class="underline" viewBox="0 0 72 8" aria-hidden="true">
			<path d="M2 5 C 16 2, 28 7, 40 4 S 60 2, 70 5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
		</svg>
		<Tags phase={item.phase} frame={item.frame} />
		<div class="chips">
			{#if item.duration}<span class="chip">{item.duration}</span>{/if}
			{#if item.meta}<span class="chip">{item.meta}</span>{/if}
			{#if item.done}<span class="chip">Done</span>{/if}
		</div>
		{#if item.slipped && item.movedFrom}
			<p class="slipped">Moved from {item.movedFrom}</p>
		{/if}
		{#if item.summary}<p class="lede">{item.summary}</p>{/if}
		{#if item.steps.length}
			<ol class="steps">
				{#each item.steps as step, index}
					<li>
						<span class="step-n" aria-hidden="true">{index + 1}</span>
						<div class="step-body">
							<p class="guide-title">{step.title}</p>
							{#if step.detail}<p class="small" style="margin-top: 4px">{step.detail}</p>{/if}
						</div>
					</li>
				{/each}
			</ol>
		{/if}
		<div class="stack" style="margin-top: 16px">
			{#if item.script}
				{@const script = item.script}
				<button
					class="pill full focus-go"
					type="button"
					onclick={() => scriptReader.set({ title: item.title, text: script })}
				>
					Read the script
				</button>
				<a class="text-btn" href={item.href} style="text-align: center">All the details</a>
			{:else}
				<a class="pill full focus-go" href={item.href}>Open</a>
			{/if}
		</div>
	{:else if !screen || screen.mode === 'empty'}
		<h1>Nothing today</h1>
		<p class="lede">The next task shows up here when it is on the plan.</p>
	{:else if screen.mode === 'past'}
		<h1>Nothing today</h1>
		<p class="lede">The last brief was {screen.pastLabel}.</p>
	{/if}

	{#if screen?.mode === 'prep' && focus?.when !== 'today'}
		{#if focus}
			<h2 style="margin-top: 28px">Prep day</h2>
		{:else}
			<h1>Prep day</h1>
			<p class="lede">Nothing to film today. The next brief is on its way.</p>
		{/if}
		<article class="card" style="margin-top: 16px">
			<p class="kicker">Next brief</p>
			<p class="countdown">{screen.countdown}</p>
			{#if screen.upcomingTitle}<p class="meta" style="margin-top: 6px">{screen.upcomingTitle}</p>{/if}
		</article>
	{/if}

	{#if screen && screen.also.length}
		<section class="section">
			<h2>Also today</h2>
			<div class="stack" style="margin-top: 12px">
				{#each screen.also as item (item.kind + item.id)}
					<a class="card prep-link" href={item.href}>
						<p class="guide-title" class:done-title={item.done}>{item.title}</p>
						<Tags phase={item.phase} frame={item.frame} />
						{#if item.slipped && item.movedFrom}
							<p class="slipped">Moved from {item.movedFrom}</p>
						{/if}
					</a>
				{/each}
			</div>
		</section>
	{/if}

	{#if screen && screen.decisions.length}
		<section class="section">
			<h2>Decide</h2>
			<div class="stack" style="margin-top: 12px">
				{#each screen.decisions as item (item.id)}
					<DecisionCard {item} />
				{/each}
			</div>
		</section>
	{/if}
</main>
