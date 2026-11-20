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

export type GuideStep = { title: string; detail?: string };

export type Guide = {
	summary?: string;
	why?: string;
	duration?: string;
	steps?: GuideStep[];
	script?: string;
	cut?: GuideStep[];
	tools?: { name: string; url?: string; note?: string }[];
	links?: { label: string; url: string }[];
	checklist?: { id: string; text: string; done?: boolean; force_status?: boolean }[];
	plan_ref?: string;
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
