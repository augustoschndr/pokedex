import { z } from 'zod';

const id = z
	.string()
	.min(1)
	.max(200)
	.regex(/^[A-Za-z0-9._:-]+$/, 'ids use letters, numbers, and . _ : -');

const text = z.string().max(20000);

export const diagramSchema = z.object({
	caption: text.optional(),
	nodes: z
		.array(
			z.object({
				id: id,
				label: text,
				detail: text.optional(),
				kind: z.string().max(40).optional()
			})
		)
		.max(40)
		.default([]),
	edges: z
		.array(
			z.object({
				from: z.string().max(200),
				to: z.string().max(200),
				label: text.optional()
			})
		)
		.max(40)
		.default([])
});

export const studyBlockSchema = z.object({
	id: id,
	heading: text.optional(),
	kind: z.enum(['text', 'callout', 'equation', 'steps', 'diagram', 'rows', 'list']),
	text: text.optional(),
	lead: text.optional(),
	equation: text.optional(),
	steps: z
		.array(
			z.object({
				title: text,
				detail: text.optional()
			})
		)
		.max(40)
		.optional(),
	diagram: diagramSchema.optional(),
	rows: z
		.array(
			z.object({
				lead: text.optional(),
				title: text,
				detail: text.optional()
			})
		)
		.max(40)
		.optional(),
	items: z.array(text).max(40).optional()
});

const blockGroupSchema = z.object({
	intro: text.optional(),
	blocks: z.array(studyBlockSchema).max(80)
});

export const ingestSchema = z.object({
	id: id,
	type: z.enum(['daily', 'weekly', 'ad_hoc']),
	timezone: z.string().min(1).max(80).default('America/Sao_Paulo'),
	for_date: z
		.string()
		.regex(/^\d{4}-\d{2}-\d{2}$/)
		.optional(),
	title: text.optional(),
	push: z
		.object({
			title: z.string().min(1).max(120),
			body: z.string().min(1).max(240)
		})
		.optional(),
	today: z
		.object({
			date_label: text.optional(),
			for_date: z
				.string()
				.regex(/^\d{4}-\d{2}-\d{2}$/)
				.optional(),
			lesson: text.optional(),
			where_it_goes: text.optional(),
			pillar: text.optional(),
			body: text.optional(),
			hook: text.optional(),
			talking_points: z.array(text).max(40).optional(),
			whiteboard: diagramSchema.optional(),
			cta: text.optional()
		})
		.optional(),
	week: z
		.object({
			intro: text.optional(),
			items: z
				.array(
					z.object({
						id: id,
						lead: text.optional(),
						title: text,
						detail: text.optional(),
						meta: text.optional(),
						status: z
							.object({
								label: z.string().min(1).max(80),
								tone: z.enum(['default', 'warning', 'success', 'info']).optional()
							})
							.optional()
					})
				)
				.max(100)
		})
		.optional(),
	todos: z
		.object({
			intro: text.optional(),
			items: z
				.array(
					z.object({
						id: id,
						text: text,
						meta: text.optional(),
						done: z.boolean().optional(),
						force_status: z.boolean().optional(),
						archived: z.boolean().optional()
					})
				)
				.max(200)
		})
		.optional(),
	study: blockGroupSchema.optional(),
	reels_rules: blockGroupSchema.optional(),
	decisions: z
		.array(
			z.object({
				id: id,
				title: text,
				detail: text.optional()
			})
		)
		.max(50)
		.optional()
});

export type IngestPayload = z.infer<typeof ingestSchema>;
export type Diagram = z.infer<typeof diagramSchema>;
export type StudyBlock = z.infer<typeof studyBlockSchema>;

export const answerSchema = z.object({
	action: z.enum(['approved', 'rejected', 'commented']),
	comment: z.string().max(4000).optional()
});

export const deleteSchema = z.object({
	confirm: z.literal('DELETE MY POKEDEX DATA'),
	keep_passkey: z.boolean()
});

export const pushSubSchema = z.object({
	endpoint: z.string().url().max(2000),
	keys: z.object({
		p256dh: z.string().min(1).max(400),
		auth: z.string().min(1).max(400)
	})
});
