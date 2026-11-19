export type DiagramNode = {
	id: string;
	label: string;
	detail?: string;
	kind?: string;
};

export type DiagramEdge = {
	from: string;
	to: string;
	label?: string;
};

export type Diagram = {
	caption?: string;
	nodes: DiagramNode[];
	edges: DiagramEdge[];
};

export type StudyBlock = {
	id: string;
	heading?: string;
	kind: 'text' | 'callout' | 'equation' | 'steps' | 'diagram' | 'rows' | 'list';
	text?: string;
	lead?: string;
	equation?: string;
	steps?: { title: string; detail?: string }[];
	diagram?: Diagram;
	rows?: { lead?: string; title: string; detail?: string }[];
	items?: string[];
};
