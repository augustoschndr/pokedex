<script lang="ts">
	let { data } = $props();
</script>

<main>
	<p class="kicker">Library</p>
	<h1>More</h1>
	<div class="stack" style="margin-top: 20px">
		<a class="card prep-link" href="/you">
			<p class="guide-title">Only you</p>
			<p class="small muted" style="margin-top: 4px">{data.openTodos} open</p>
		</a>
		<a class="card prep-link" href="/study">
			<p class="guide-title">Study</p>
			<p class="small muted" style="margin-top: 4px">{data.studyCount} {data.studyCount === 1 ? 'note' : 'notes'}</p>
		</a>
		<a class="card prep-link" href="/briefs">
			<p class="guide-title">Briefs</p>
			<p class="small muted" style="margin-top: 4px">{data.briefCount} posted</p>
		</a>
		<a class="card prep-link" href="/decisions">
			<p class="guide-title">Decisions</p>
			<p class="small muted" style="margin-top: 4px">{data.pending} waiting</p>
		</a>
		<a class="card prep-link" href="/settings">
			<p class="guide-title">Settings</p>
		</a>
	</div>
</main>
