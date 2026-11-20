<script lang="ts">
	import SettingsLink from '$lib/components/SettingsLink.svelte';

	let { data } = $props();

	function tone(tone: string | undefined) {
		if (tone === 'warning') return 'warn';
		if (tone === 'success') return 'ok';
		if (tone === 'info') return 'info';
		return '';
	}
</script>

<main>
	<div class="toprow">
		<div class="titles">
			<p class="kicker">{data.dateLabel || 'Shot list'}</p>
			<h1>This week</h1>
		</div>
		<SettingsLink />
	</div>
	{#if data.intro}<p class="meta">{data.intro}</p>{/if}
	{#if data.plan}
		<a class="card prep-link" href="/week/plan" style="margin-top: 16px">
			<p class="kicker">Plan</p>
			<p class="guide-title" style="margin-top: 4px">{data.plan.done} of {data.plan.total} done</p>
		</a>
	{/if}

	{#if data.days.length === 0}
		<p class="lede">No shots on the list yet.</p>
	{:else}
		<div class="stack" style="margin-top: 16px">
			{#each data.days as day (day.date)}
				{#if day.items.length === 0}
					<p class="day-line" class:today={day.relation === 'today'} class:past={day.relation === 'past'}>
						<span>{day.label}</span>
						<span class="muted">{day.relation === 'today' ? 'Today · nothing scheduled' : 'Nothing scheduled'}</span>
					</p>
				{:else}
					<article
						class="card day"
						class:today={day.relation === 'today'}
						class:past={day.relation === 'past'}
						aria-current={day.relation === 'today' ? 'date' : undefined}
					>
						<div class="week-top">
							<span class="lead">{day.label}</span>
							{#if day.relation === 'today'}<span class="chip">Today</span>{/if}
						</div>
						{#each day.items as item}
							<div class="shot">
								<div class="week-top">
									<h2><a href="/week/{item.id}">{item.title}</a></h2>
									{#if item.status}
										<span class="chip">
											<span class="dot {tone(item.status.tone)}"></span>
											{item.status.label}
										</span>
									{/if}
								</div>
								{#if item.detail}<p class="meta" style="margin-top: 6px">{item.detail}</p>{/if}
								{#if item.meta || item.duration}
									<p class="small muted" style="margin-top: 8px">
										{item.duration ?? ''}{item.duration && item.meta ? ' · ' : ''}{item.meta ?? ''}
									</p>
								{/if}
							</div>
						{/each}
					</article>
				{/if}
			{/each}
			{#if data.undated.length}
				<article class="card">
					<p class="lead">No date</p>
					{#each data.undated as item}
						<p class="small" style="margin-top: 8px"><a class="shot-link" href="/week/{item.id}">{item.title}</a></p>
					{/each}
				</article>
			{/if}
		</div>
	{/if}
</main>
