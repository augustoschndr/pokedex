<script lang="ts">
	import type { Diagram } from '$lib/types';

	let { diagram }: { diagram: Diagram } = $props();

	const order = $derived.by(() => {
		const nodes = diagram.nodes ?? [];
		const byId = new Map(nodes.map((node) => [node.id, node]));
		const edgeFrom = new Map((diagram.edges ?? []).map((edge) => [edge.from, edge]));
		return nodes.map((node, index) => {
			const prev = index > 0 ? nodes[index - 1] : null;
			const edge = prev ? edgeFrom.get(prev.id) : undefined;
			const label = edge && edge.to === node.id ? edge.label : undefined;
			return { node: byId.get(node.id) ?? node, label };
		});
	});
</script>

<div class="diagram">
	{#each order as row, index}
		{#if index > 0}
			<div class="connector">{row.label ?? ''}</div>
		{/if}
		<div class="node" class:terminal={row.node.kind === 'terminal'}>
			<strong>{row.node.label}</strong>
			{#if row.node.detail}<span class="small">{row.node.detail}</span>{/if}
		</div>
	{/each}
	{#if diagram.caption}<p class="meta" style="margin-top: 10px">{diagram.caption}</p>{/if}
</div>
