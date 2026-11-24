import { formatDayNum, isSlipped, planDate } from '$lib/calendar';
import { optionLabel } from '$lib/decisions';
import { frameStage } from '$lib/frame';
import { effectiveDate } from '$lib/schedule';
import type { Guide, GuideStep } from '$lib/types';
import type { Diagram, StudyBlock } from '$lib/types';
import { randomId } from './crypto';
import { db, getMeta } from './db';
import { timeZone } from './env';
import { formatInZone, nowIso, nowMs } from './time';

export type TodayView = {
	date_label: string | null;
	for_date: string | null;
	lesson: string | null;
	where_it_goes: string | null;
	pillar: string | null;
	body: string | null;
	hook: string | null;
	talking_points: string[];
	whiteboard: Diagram | null;
	cta: string | null;
	updated_at: string;
};

export type WeekItemView = {
	id: string;
	lead: string | null;
	title: string;
	detail: string | null;
	meta: string | null;
	status: { label: string; tone: string } | null;
	done: boolean;
	duration: string | null;
	date: string | null;
};

export type TodoView = {
	id: string;
	text: string;
	meta: string | null;
	done: boolean;
	done_at: string | null;
	phase: string | null;
	frame: string | null;
};

export type StudyBlockView = StudyBlock;

export type DecisionView = {
	id: string;
	title: string;
	detail: string | null;
	status: string;
	comment: string | null;
	answered_at: string | null;
	option: string | null;
};

function parseJson<T>(value: string | null, fallback: T): T {
	if (!value) return fallback;
	try {
		return JSON.parse(value) as T;
	} catch {
		return fallback;
	}
}

function readGuide(value: string | null): Guide | null {
	const guide = parseJson<Guide | null>(value, null);
	if (!guide || typeof guide !== 'object') return null;
	return guide;
}

function presentDoneAt(value: string | null): string | null {
	if (!value) return null;
	const ms = Date.parse(value);
	if (Number.isNaN(ms)) return value;
	return formatInZone(ms, timeZone());
}

function parentIsOpen(userId: string, parentKind: 'todo' | 'week', parentId: string): boolean {
	if (parentKind === 'todo') {
		const row = db()
			.prepare('SELECT archived FROM todo WHERE user_id = ? AND id = ?')
			.get(userId, parentId) as { archived: number } | undefined;
		return Boolean(row && row.archived === 0);
	}
	const row = db()
		.prepare(
			`SELECT 1 AS ok FROM week_item WHERE user_id = ? AND ingest_id = ? AND is_current = 1 LIMIT 1`
		)
		.get(userId, parentId);
	return Boolean(row);
}

export type CheckView = { id: string; text: string; done: boolean };

export type StepNote = { index: number; text: string };

export type TaskView = {
	kind: 'todo' | 'week';
	id: string;
	title: string;
	detail: string | null;
	meta: string | null;
	lead: string | null;
	status: { label: string; tone: string } | null;
	done: boolean;
	guide: Guide | null;
	checklist: CheckView[];
	stepNotes: StepNote[];
	plan: {
		id: string;
		title: string;
		kind: 'phase' | 'milestone';
		phaseId: string;
		phaseTitle: string;
		frame: string | null;
	} | null;
	back: string;
};

type PlanHit = NonNullable<TaskView['plan']>;

function phaseDirectory(userId: string): Map<string, PlanHit> {
	const phases = db()
		.prepare(`SELECT id, title FROM plan_phase WHERE user_id = ?`)
		.all(userId) as { id: string; title: string }[];
	const milestones = db()
		.prepare(`SELECT id, phase_id, title FROM plan_milestone WHERE user_id = ?`)
		.all(userId) as { id: string; phase_id: string; title: string }[];
	const map = new Map<string, PlanHit>();
	for (const phase of phases) {
		map.set(phase.id, {
			id: phase.id,
			title: phase.title,
			kind: 'phase',
			phaseId: phase.id,
			phaseTitle: phase.title,
			frame: frameStage(phase.title)
		});
	}
	for (const milestone of milestones) {
		const phase = map.get(milestone.phase_id);
		if (!phase) continue;
		map.set(milestone.id, {
			id: milestone.id,
			title: milestone.title,
			kind: 'milestone',
			phaseId: phase.phaseId,
			phaseTitle: phase.phaseTitle,
			frame: phase.frame
		});
	}
	return map;
}

function notesFor(userId: string, parentKind: 'todo' | 'week', parentId: string): StepNote[] {
	const rows = db()
		.prepare(
			`SELECT step_index, text FROM step_comment
       WHERE user_id = ? AND parent_kind = ? AND parent_id = ?
       ORDER BY step_index ASC`
		)
		.all(userId, parentKind, parentId) as { step_index: number; text: string }[];
	return rows.map((row) => ({ index: row.step_index, text: row.text }));
}

function checklistFor(userId: string, parentKind: 'todo' | 'week', parentId: string): CheckView[] {
	const rows = db()
		.prepare(
			`SELECT id, text, done FROM checklist
       WHERE user_id = ? AND parent_kind = ? AND parent_id = ? AND archived = 0
       ORDER BY sort_order ASC, id ASC`
		)
		.all(userId, parentKind, parentId) as { id: string; text: string; done: number }[];
	return rows.map((row) => ({ id: row.id, text: row.text, done: row.done === 1 }));
}

function planLabel(userId: string, ref: string | undefined): TaskView['plan'] {
	if (!ref) return null;
	return phaseDirectory(userId).get(ref) ?? null;
}

export function getTask(userId: string, kind: 'todo' | 'week', id: string): TaskView | null {
	if (kind === 'todo') {
		const row = db()
			.prepare(
				`SELECT id, text, meta, done, guide_json, base_date, scheduled_on
         FROM todo WHERE user_id = ? AND id = ? AND archived = 0`
			)
			.get(userId, id) as
			| {
					id: string;
					text: string;
					meta: string | null;
					done: number;
					guide_json: string | null;
					base_date: string | null;
					scheduled_on: string | null;
			  }
			| undefined;
		if (!row) return null;
		const guide = readGuide(row.guide_json);
		const date = effectiveDate(row.base_date, row.scheduled_on, row.id);
		return {
			kind: 'todo',
			id: row.id,
			title: row.text,
			detail: null,
			meta: row.meta,
			lead: date ? formatDayNum(date) : null,
			status: null,
			done: row.done === 1,
			guide,
			checklist: checklistFor(userId, 'todo', row.id),
			stepNotes: notesFor(userId, 'todo', row.id),
			plan: planLabel(userId, guide?.plan_ref),
			back: '/you'
		};
	}
	const row = db()
		.prepare(
			`SELECT ingest_id, lead, title, detail, meta, status_label, status_tone, done, guide_json, base_date, scheduled_on
       FROM week_item WHERE user_id = ? AND ingest_id = ? AND is_current = 1`
		)
		.get(userId, id) as
		| {
				ingest_id: string;
				lead: string | null;
				title: string;
				detail: string | null;
				meta: string | null;
				status_label: string | null;
				status_tone: string | null;
				done: number;
				guide_json: string | null;
				base_date: string | null;
				scheduled_on: string | null;
		  }
		| undefined;
	if (!row) return null;
	const guide = readGuide(row.guide_json);
	const date = effectiveDate(row.base_date, row.scheduled_on, row.ingest_id);
	return {
		kind: 'week',
		id: row.ingest_id,
		title: row.title,
		detail: row.detail,
		meta: row.meta,
		lead: date ? formatDayNum(date) : row.lead,
		status: row.status_label ? { label: row.status_label, tone: row.status_tone ?? 'default' } : null,
		done: row.done === 1,
		guide,
		checklist: checklistFor(userId, 'week', row.ingest_id),
		stepNotes: notesFor(userId, 'week', row.ingest_id),
		plan: planLabel(userId, guide?.plan_ref),
		back: '/week'
	};
}

export type PlanTask = {
	kind: 'todo' | 'week';
	id: string;
	title: string;
	done: boolean;
	phase: string | null;
	frame: string | null;
};

export type PlanMilestoneView = {
	id: string;
	title: string;
	detail: string | null;
	done: number;
	total: number;
	tasks: PlanTask[];
};

export type PlanPhaseView = {
	id: string;
	title: string;
	detail: string | null;
	done: number;
	total: number;
	milestones: PlanMilestoneView[];
	tasks: PlanTask[];
};

export type PlanView = {
	done: number;
	total: number;
	phases: PlanPhaseView[];
};

export function currentPlan(userId: string): PlanView | null {
	const phases = db()
		.prepare(
			`SELECT id, title, detail FROM plan_phase WHERE user_id = ? ORDER BY sort_order ASC, id ASC`
		)
		.all(userId) as { id: string; title: string; detail: string | null }[];
	if (!phases.length) return null;
	const milestones = db()
		.prepare(
			`SELECT id, phase_id, title, detail FROM plan_milestone
       WHERE user_id = ? ORDER BY sort_order ASC, id ASC`
		)
		.all(userId) as { id: string; phase_id: string; title: string; detail: string | null }[];
	const directory = phaseDirectory(userId);
	const tasks = linkedTasks(userId);
	const byRef = new Map<string, PlanTask[]>();
	for (const task of tasks) {
		const hit = directory.get(task.ref);
		const list = byRef.get(task.ref) ?? [];
		list.push({
			kind: task.kind,
			id: task.id,
			title: task.title,
			done: task.done,
			phase: hit?.phaseTitle ?? null,
			frame: hit?.frame ?? null
		});
		byRef.set(task.ref, list);
	}
	const phaseViews = phases.map((phase) => {
		const phaseTasks = byRef.get(phase.id) ?? [];
		const milestoneViews = milestones
			.filter((milestone) => milestone.phase_id === phase.id)
			.map((milestone) => {
				const linked = byRef.get(milestone.id) ?? [];
				return {
					id: milestone.id,
					title: milestone.title,
					detail: milestone.detail,
					done: linked.filter((task) => task.done).length,
					total: linked.length,
					tasks: linked
				};
			});
		const counted = [...phaseTasks, ...milestoneViews.flatMap((milestone) => milestone.tasks)];
		return {
			id: phase.id,
			title: phase.title,
			detail: phase.detail,
			done: counted.filter((task) => task.done).length,
			total: counted.length,
			milestones: milestoneViews,
			tasks: phaseTasks
		};
	});
	return {
		done: phaseViews.reduce((sum, phase) => sum + phase.done, 0),
		total: phaseViews.reduce((sum, phase) => sum + phase.total, 0),
		phases: phaseViews
	};
}

function linkedTasks(userId: string): { ref: string; kind: 'todo' | 'week'; id: string; title: string; done: boolean }[] {
	const todos = db()
		.prepare(`SELECT id, text, done, guide_json FROM todo WHERE user_id = ? AND archived = 0`)
		.all(userId) as { id: string; text: string; done: number; guide_json: string | null }[];
	const week = db()
		.prepare(
			`SELECT ingest_id, title, done, guide_json FROM week_item WHERE user_id = ? AND is_current = 1`
		)
		.all(userId) as { ingest_id: string; title: string; done: number; guide_json: string | null }[];
	const linked: { ref: string; kind: 'todo' | 'week'; id: string; title: string; done: boolean }[] = [];
	for (const row of todos) {
		const ref = readGuide(row.guide_json)?.plan_ref;
		if (ref) linked.push({ ref, kind: 'todo', id: row.id, title: row.text, done: row.done === 1 });
	}
	for (const row of week) {
		const ref = readGuide(row.guide_json)?.plan_ref;
		if (ref) linked.push({ ref, kind: 'week', id: row.ingest_id, title: row.title, done: row.done === 1 });
	}
	return linked;
}

export type StepCommentRecord = {
	index: number;
	comment: string;
	updated_at: string;
};

export type TickRecord = {
	id: string;
	parent_id: string | null;
	parent_kind: 'todo' | 'week' | null;
	kind: 'todo' | 'week' | 'checklist';
	done: boolean;
	done_at: string | null;
	epoch: number | null;
	date?: string | null;
	steps?: StepCommentRecord[];
};

type CommentHit = StepCommentRecord & { ms: number };

function commentMap(userId: string): Map<string, CommentHit[]> {
	const rows = db()
		.prepare(
			`SELECT parent_kind, parent_id, step_index, text, updated_at
       FROM step_comment WHERE user_id = ? ORDER BY step_index ASC`
		)
		.all(userId) as {
		parent_kind: 'todo' | 'week';
		parent_id: string;
		step_index: number;
		text: string;
		updated_at: string;
	}[];
	const map = new Map<string, CommentHit[]>();
	for (const row of rows) {
		const key = `${row.parent_kind}:${row.parent_id}`;
		const list = map.get(key) ?? [];
		const ms = Date.parse(row.updated_at);
		list.push({
			index: row.step_index,
			comment: row.text,
			updated_at: presentDoneAt(row.updated_at) ?? row.updated_at,
			ms: Number.isNaN(ms) ? 0 : ms
		});
		map.set(key, list);
	}
	return map;
}

function withSteps(record: TickRecord, comments: Map<string, CommentHit[]>): TickRecord {
	if (record.kind === 'checklist') return record;
	const hits = comments.get(`${record.kind}:${record.id}`) ?? [];
	return {
		...record,
		steps: hits.map(({ index, comment, updated_at }) => ({ index, comment, updated_at }))
	};
}

export function listTicks(userId: string, sinceMs: number | null): TickRecord[] {
	const todos = db()
		.prepare(
			`SELECT id, done, done_at, status_epoch, base_date, scheduled_on FROM todo
       WHERE user_id = ? AND archived = 0 AND (? IS NULL OR status_epoch >= ?)
       ORDER BY status_epoch ASC, id ASC`
		)
		.all(userId, sinceMs, sinceMs) as {
		id: string;
		done: number;
		done_at: string | null;
		status_epoch: number | null;
		base_date: string | null;
		scheduled_on: string | null;
	}[];
	const week = db()
		.prepare(
			`SELECT ingest_id, done, done_at, status_epoch, base_date, scheduled_on FROM week_item
       WHERE user_id = ? AND is_current = 1 AND (? IS NULL OR status_epoch >= ?)
       ORDER BY status_epoch ASC, ingest_id ASC`
		)
		.all(userId, sinceMs, sinceMs) as {
		ingest_id: string;
		done: number;
		done_at: string | null;
		status_epoch: number | null;
		base_date: string | null;
		scheduled_on: string | null;
	}[];
	const checks = db()
		.prepare(
			`SELECT id, parent_kind, parent_id, done, done_at, status_epoch FROM checklist
       WHERE user_id = ? AND archived = 0 AND (? IS NULL OR status_epoch >= ?)
       ORDER BY status_epoch ASC, id ASC`
		)
		.all(userId, sinceMs, sinceMs) as {
		id: string;
		parent_kind: 'todo' | 'week';
		parent_id: string;
		done: number;
		done_at: string | null;
		status_epoch: number | null;
	}[];
	const openChecks = checks.filter((row) => parentIsOpen(userId, row.parent_kind, row.parent_id));
	const comments = commentMap(userId);
	const records: TickRecord[] = [
		...todos.map((row) => ({
			id: row.id,
			parent_id: null,
			parent_kind: null,
			kind: 'todo' as const,
			done: row.done === 1,
			done_at: presentDoneAt(row.done_at),
			epoch: row.status_epoch,
			date: effectiveDate(row.base_date, row.scheduled_on, row.id)
		})),
		...week.map((row) => ({
			id: row.ingest_id,
			parent_id: null,
			parent_kind: null,
			kind: 'week' as const,
			done: row.done === 1,
			done_at: presentDoneAt(row.done_at),
			epoch: row.status_epoch,
			date: effectiveDate(row.base_date, row.scheduled_on, row.ingest_id)
		})),
		...openChecks.map((row) => ({
			id: row.id,
			parent_id: row.parent_id,
			parent_kind: row.parent_kind,
			kind: 'checklist' as const,
			done: row.done === 1,
			done_at: presentDoneAt(row.done_at),
			epoch: row.status_epoch
		}))
	];
	if (sinceMs !== null) {
		const have = new Set(records.map((record) => `${record.kind}:${record.id}`));
		for (const [key, hits] of comments) {
			if (!hits.some((hit) => hit.ms >= sinceMs) || have.has(key)) continue;
			const split = key.indexOf(':');
			const kind = key.slice(0, split) as 'todo' | 'week';
			const id = key.slice(split + 1);
			const extra = parentTick(userId, kind, id);
			if (extra) records.push(extra);
		}
	}
	return records
		.map((record) => withSteps(record, comments))
		.sort((a, b) => (a.epoch ?? -1) - (b.epoch ?? -1) || a.kind.localeCompare(b.kind) || a.id.localeCompare(b.id));
}

function parentTick(userId: string, kind: 'todo' | 'week', id: string): TickRecord | null {
	if (kind === 'todo') {
		const row = db()
			.prepare(
				`SELECT id, done, done_at, status_epoch, base_date, scheduled_on
         FROM todo WHERE user_id = ? AND id = ? AND archived = 0`
			)
			.get(userId, id) as
			| {
					id: string;
					done: number;
					done_at: string | null;
					status_epoch: number | null;
					base_date: string | null;
					scheduled_on: string | null;
			  }
			| undefined;
		if (!row) return null;
		return {
			id: row.id,
			parent_id: null,
			parent_kind: null,
			kind: 'todo',
			done: row.done === 1,
			done_at: presentDoneAt(row.done_at),
			epoch: row.status_epoch,
			date: effectiveDate(row.base_date, row.scheduled_on, row.id)
		};
	}
	const row = db()
		.prepare(
			`SELECT ingest_id, done, done_at, status_epoch, base_date, scheduled_on
       FROM week_item WHERE user_id = ? AND ingest_id = ? AND is_current = 1`
		)
		.get(userId, id) as
		| {
				ingest_id: string;
				done: number;
				done_at: string | null;
				status_epoch: number | null;
				base_date: string | null;
				scheduled_on: string | null;
		  }
		| undefined;
	if (!row) return null;
	return {
		id: row.ingest_id,
		parent_id: null,
		parent_kind: null,
		kind: 'week',
		done: row.done === 1,
		done_at: presentDoneAt(row.done_at),
		epoch: row.status_epoch,
		date: effectiveDate(row.base_date, row.scheduled_on, row.ingest_id)
	};
}

export function currentToday(userId: string): TodayView | null {
	const row = db()
		.prepare(
			`SELECT * FROM today_item WHERE user_id = ? AND is_current = 1 ORDER BY updated_at DESC LIMIT 1`
		)
		.get(userId) as Record<string, unknown> | undefined;
	return row ? todayFromRow(row) : null;
}

export function currentWeek(userId: string): { intro: string; items: WeekItemView[] } {
	const rows = db()
		.prepare(
			`SELECT ingest_id, lead, title, detail, meta, status_label, status_tone, done, guide_json, base_date, scheduled_on
       FROM week_item WHERE user_id = ? AND is_current = 1 ORDER BY sort_order ASC`
		)
		.all(userId) as {
		ingest_id: string;
		lead: string | null;
		title: string;
		detail: string | null;
		meta: string | null;
		status_label: string | null;
		status_tone: string | null;
		done: number;
		guide_json: string | null;
		base_date: string | null;
		scheduled_on: string | null;
	}[];
	return {
		intro: getMeta(userId, 'week_intro'),
		items: rows.map((row) => ({
			id: row.ingest_id,
			lead: row.lead,
			title: row.title,
			detail: row.detail,
			meta: row.meta,
			status: row.status_label ? { label: row.status_label, tone: row.status_tone ?? 'default' } : null,
			done: row.done === 1,
			duration: readGuide(row.guide_json)?.duration ?? null,
			date: effectiveDate(row.base_date, row.scheduled_on, row.ingest_id)
		}))
	};
}

export function scheduledTodos(userId: string): { id: string; text: string; done: boolean; date: string; order: number }[] {
	const rows = db()
		.prepare(
			`SELECT id, text, done, base_date, scheduled_on, sort_order
       FROM todo WHERE user_id = ? AND archived = 0 ORDER BY sort_order ASC, id ASC`
		)
		.all(userId) as {
		id: string;
		text: string;
		done: number;
		base_date: string | null;
		scheduled_on: string | null;
		sort_order: number;
	}[];
	const dated: { id: string; text: string; done: boolean; date: string; order: number }[] = [];
	for (const row of rows) {
		const date = effectiveDate(row.base_date, row.scheduled_on, row.id);
		if (!date) continue;
		dated.push({
			id: row.id,
			text: row.text,
			done: row.done === 1,
			date,
			order: 1000 + row.sort_order
		});
	}
	return dated;
}

export function currentTodos(userId: string): { intro: string; items: TodoView[] } {
	const directory = phaseDirectory(userId);
	const rows = db()
		.prepare(
			`SELECT id, text, meta, done, done_at, guide_json FROM todo
       WHERE user_id = ? AND archived = 0 ORDER BY sort_order ASC, id ASC`
		)
		.all(userId) as {
		id: string;
		text: string;
		meta: string | null;
		done: number;
		done_at: string | null;
		guide_json: string | null;
	}[];
	return {
		intro: getMeta(userId, 'todos_intro'),
		items: rows.map((row) => {
			const hit = directory.get(readGuide(row.guide_json)?.plan_ref ?? '');
			return {
				id: row.id,
				text: row.text,
				meta: row.meta,
				done: row.done === 1,
				done_at: row.done_at,
				phase: hit?.phaseTitle ?? null,
				frame: hit?.frame ?? null
			};
		})
	};
}

export type ScheduledItem = {
	kind: 'todo' | 'week';
	id: string;
	title: string;
	done: boolean;
	date: string;
	order: number;
	phase: string | null;
	frame: string | null;
	slipped: boolean;
	movedFrom: string | null;
	detail: string | null;
	meta: string | null;
	summary: string | null;
	duration: string | null;
	steps: GuideStep[];
	script: string | null;
};

export function scheduledItems(userId: string): ScheduledItem[] {
	const directory = phaseDirectory(userId);
	const todos = db()
		.prepare(
			`SELECT id, text, meta, done, guide_json, base_date, scheduled_on, sort_order
       FROM todo WHERE user_id = ? AND archived = 0 ORDER BY sort_order ASC, id ASC`
		)
		.all(userId) as {
		id: string;
		text: string;
		meta: string | null;
		done: number;
		guide_json: string | null;
		base_date: string | null;
		scheduled_on: string | null;
		sort_order: number;
	}[];
	const week = db()
		.prepare(
			`SELECT ingest_id, title, detail, meta, done, guide_json, base_date, scheduled_on, sort_order
       FROM week_item WHERE user_id = ? AND is_current = 1 ORDER BY sort_order ASC`
		)
		.all(userId) as {
		ingest_id: string;
		title: string;
		detail: string | null;
		meta: string | null;
		done: number;
		guide_json: string | null;
		base_date: string | null;
		scheduled_on: string | null;
		sort_order: number;
	}[];
	const items: ScheduledItem[] = [];
	const push = (
		kind: 'todo' | 'week',
		id: string,
		title: string,
		detail: string | null,
		meta: string | null,
		done: number,
		guideJson: string | null,
		base: string | null,
		scheduled: string | null,
		order: number
	) => {
		const date = effectiveDate(base, scheduled, id);
		if (!date) return;
		const guide = readGuide(guideJson);
		const hit = directory.get(guide?.plan_ref ?? '');
		const slipped = isSlipped(base, scheduled, id);
		const from = planDate(base, id);
		items.push({
			kind,
			id,
			title,
			done: done === 1,
			date,
			order,
			phase: hit?.phaseTitle ?? null,
			frame: hit?.frame ?? null,
			slipped,
			movedFrom: slipped && from ? from : null,
			detail,
			meta,
			summary: guide?.summary ?? detail,
			duration: guide?.duration ?? null,
			steps: guide?.steps ?? [],
			script: guide?.script?.trim() || null
		});
	};
	week.forEach((row, index) =>
		push(
			'week',
			row.ingest_id,
			row.title,
			row.detail,
			row.meta,
			row.done,
			row.guide_json,
			row.base_date,
			row.scheduled_on,
			index
		)
	);
	for (const row of todos) {
		push(
			'todo',
			row.id,
			row.text,
			null,
			row.meta,
			row.done,
			row.guide_json,
			row.base_date,
			row.scheduled_on,
			1000 + row.sort_order
		);
	}
	return items;
}

export type BriefSummary = {
	id: string;
	lesson: string | null;
	for_date: string | null;
	date_label: string | null;
	current: boolean;
};

function todayFromRow(row: Record<string, unknown>): TodayView {
	return {
		date_label: (row.date_label as string | null) ?? null,
		for_date: (row.for_date as string | null) ?? null,
		lesson: (row.lesson as string | null) ?? null,
		where_it_goes: (row.where_it_goes as string | null) ?? null,
		pillar: (row.pillar as string | null) ?? null,
		body: (row.body as string | null) ?? null,
		hook: (row.hook as string | null) ?? null,
		talking_points: parseJson<string[]>(row.talking_points_json as string | null, []),
		whiteboard: parseJson<Diagram | null>(row.whiteboard_json as string | null, null),
		cta: (row.cta as string | null) ?? null,
		updated_at: row.updated_at as string
	};
}

export function listBriefs(userId: string): BriefSummary[] {
	const rows = db()
		.prepare(
			`SELECT id, lesson, for_date, date_label, is_current FROM today_item
       WHERE user_id = ? ORDER BY is_current DESC, updated_at DESC`
		)
		.all(userId) as {
		id: string;
		lesson: string | null;
		for_date: string | null;
		date_label: string | null;
		is_current: number;
	}[];
	return rows.map((row) => ({
		id: row.id,
		lesson: row.lesson,
		for_date: row.for_date,
		date_label: row.date_label,
		current: row.is_current === 1
	}));
}

export function getBrief(userId: string, id: string): TodayView | null {
	const row = db()
		.prepare(`SELECT * FROM today_item WHERE user_id = ? AND id = ?`)
		.get(userId, id) as Record<string, unknown> | undefined;
	return row ? todayFromRow(row) : null;
}

function currentBlocks(userId: string, group: 'study' | 'reels_rules'): StudyBlockView[] {
	const rows = db()
		.prepare(
			`SELECT ingest_id, heading, kind, body_json FROM study_block
       WHERE user_id = ? AND grp = ? AND is_current = 1 ORDER BY sort_order ASC`
		)
		.all(userId, group) as {
		ingest_id: string;
		heading: string | null;
		kind: StudyBlock['kind'];
		body_json: string;
	}[];
	return rows.map((row) => {
		const body = parseJson<Partial<StudyBlock>>(row.body_json, {});
		return {
			id: row.ingest_id,
			heading: row.heading ?? undefined,
			kind: row.kind,
			...body
		};
	});
}

export function currentStudy(userId: string): {
	study: { intro: string; blocks: StudyBlockView[] };
	reels_rules: { intro: string; blocks: StudyBlockView[] };
} {
	return {
		study: { intro: getMeta(userId, 'study_intro'), blocks: currentBlocks(userId, 'study') },
		reels_rules: {
			intro: getMeta(userId, 'reels_intro'),
			blocks: currentBlocks(userId, 'reels_rules')
		}
	};
}

export function currentDecisions(userId: string): DecisionView[] {
	const rows = db()
		.prepare(
			`SELECT id, title, detail, status, answer_comment, answered_epoch
       FROM decision WHERE user_id = ?
       ORDER BY CASE status WHEN 'pending' THEN 0 ELSE 1 END, updated_at DESC`
		)
		.all(userId) as {
		id: string;
		title: string;
		detail: string | null;
		status: string;
		answer_comment: string | null;
		answered_epoch: number | null;
	}[];
	return rows.map((row) => ({
		id: row.id,
		title: row.title,
		detail: row.detail,
		status: row.status,
		comment: row.answer_comment,
		answered_at: row.answered_epoch ? formatInZone(row.answered_epoch, timeZone()) : null,
		option: row.status === 'pending' ? null : optionLabel(row.status)
	}));
}

export function pendingDecisionCount(userId: string): number {
	const row = db()
		.prepare(`SELECT COUNT(*) AS c FROM decision WHERE user_id = ? AND status = 'pending'`)
		.get(userId) as { c: number };
	return row.c;
}

export function toggleTodo(userId: string, id: string): Omit<TodoView, 'phase' | 'frame'> | null {
	const row = db()
		.prepare('SELECT id, text, meta, done, done_at, archived FROM todo WHERE user_id = ? AND id = ?')
		.get(userId, id) as
		| { id: string; text: string; meta: string | null; done: number; done_at: string | null; archived: number }
		| undefined;
	if (!row || row.archived) return null;
	const done = row.done ? 0 : 1;
	const epoch = nowMs();
	const doneAt = done ? formatInZone(epoch, timeZone()) : null;
	db()
		.prepare(
			'UPDATE todo SET done = ?, done_at = ?, status_epoch = ?, updated_at = ? WHERE user_id = ? AND id = ?'
		)
		.run(done, doneAt, epoch, nowIso(), userId, id);
	return { id: row.id, text: row.text, meta: row.meta, done: done === 1, done_at: doneAt };
}

export function toggleWeek(userId: string, id: string): { id: string; done: boolean; done_at: string | null } | null {
	const row = db()
		.prepare(
			`SELECT ingest_id, done FROM week_item WHERE user_id = ? AND ingest_id = ? AND is_current = 1`
		)
		.get(userId, id) as { ingest_id: string; done: number } | undefined;
	if (!row) return null;
	const done = row.done ? 0 : 1;
	const epoch = nowMs();
	const doneAt = done ? formatInZone(epoch, timeZone()) : null;
	db()
		.prepare(
			`UPDATE week_item SET done = ?, done_at = ?, status_epoch = ?, updated_at = ?
       WHERE user_id = ? AND ingest_id = ? AND is_current = 1`
		)
		.run(done, doneAt, epoch, nowIso(), userId, id);
	return { id: row.ingest_id, done: done === 1, done_at: doneAt };
}

export function toggleChecklist(
	userId: string,
	parentKind: 'todo' | 'week',
	parentId: string,
	id: string
): { id: string; parent_id: string; done: boolean; done_at: string | null } | null {
	if (!parentIsOpen(userId, parentKind, parentId)) return null;
	const row = db()
		.prepare(
			`SELECT id, done FROM checklist
       WHERE user_id = ? AND parent_kind = ? AND parent_id = ? AND id = ? AND archived = 0`
		)
		.get(userId, parentKind, parentId, id) as { id: string; done: number } | undefined;
	if (!row) return null;
	const done = row.done ? 0 : 1;
	const epoch = nowMs();
	const doneAt = done ? formatInZone(epoch, timeZone()) : null;
	db()
		.prepare(
			`UPDATE checklist SET done = ?, done_at = ?, status_epoch = ?, updated_at = ?
       WHERE user_id = ? AND parent_kind = ? AND parent_id = ? AND id = ?`
		)
		.run(done, doneAt, epoch, nowIso(), userId, parentKind, parentId, id);
	return { id: row.id, parent_id: parentId, done: done === 1, done_at: doneAt };
}

export function saveStepComment(
	userId: string,
	parentKind: 'todo' | 'week',
	parentId: string,
	index: number,
	text: string
): { step: { index: number; comment: string; updated_at: string } | null } | null {
	const task = getTask(userId, parentKind, parentId);
	const steps = task?.guide?.steps ?? [];
	if (!task || index < 0 || index >= steps.length) return null;
	const trimmed = text.trim();
	if (!trimmed) {
		db()
			.prepare(
				`DELETE FROM step_comment
         WHERE user_id = ? AND parent_kind = ? AND parent_id = ? AND step_index = ?`
			)
			.run(userId, parentKind, parentId, index);
		return { step: null };
	}
	const at = nowIso();
	db()
		.prepare(
			`INSERT INTO step_comment (user_id, parent_kind, parent_id, step_index, text, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_id, parent_kind, parent_id, step_index) DO UPDATE SET
         text = excluded.text,
         updated_at = excluded.updated_at`
		)
		.run(userId, parentKind, parentId, index, trimmed, at);
	return {
		step: {
			index,
			comment: trimmed,
			updated_at: formatInZone(Date.parse(at), timeZone())
		}
	};
}

export type AnswerRecord = {
	id: string;
	title: string;
	action: 'approved' | 'rejected' | 'commented';
	option: string | null;
	comment: string | null;
	answered_at: string;
	epoch: number;
};

export function answerDecision(
	userId: string,
	id: string,
	action: 'approved' | 'rejected' | 'commented',
	comment: string | null
): AnswerRecord | null {
	const row = db()
		.prepare('SELECT id, title FROM decision WHERE user_id = ? AND id = ?')
		.get(userId, id) as { id: string; title: string } | undefined;
	if (!row) return null;
	const epoch = nowMs();
	const at = nowIso();
	db()
		.prepare(
			`UPDATE decision
       SET status = ?, answer_comment = ?, answered_at = ?, answered_epoch = ?, notified_back_at = NULL, updated_at = ?
       WHERE user_id = ? AND id = ?`
		)
		.run(action, comment, at, epoch, at, userId, id);
	db()
		.prepare(
			`INSERT INTO decision_event (id, user_id, decision_id, action, comment, at) VALUES (?, ?, ?, ?, ?, ?)`
		)
		.run(randomId(), userId, id, action, comment, at);
	return {
		id: row.id,
		title: row.title,
		action,
		option: optionLabel(action),
		comment,
		answered_at: formatInZone(epoch, timeZone()),
		epoch
	};
}

export function listAnswers(userId: string, sinceMs: number | null, limit: number): AnswerRecord[] {
	const rows = db()
		.prepare(
			`SELECT id, title, status, answer_comment, answered_epoch
       FROM decision
       WHERE user_id = ? AND answered_epoch IS NOT NULL AND (? IS NULL OR answered_epoch >= ?)
       ORDER BY answered_epoch ASC
       LIMIT ?`
		)
		.all(userId, sinceMs, sinceMs, limit) as {
		id: string;
		title: string;
		status: 'approved' | 'rejected' | 'commented';
		answer_comment: string | null;
		answered_epoch: number;
	}[];
	if (rows.length) {
		const ids = rows.map((row) => row.id);
		const marks = db().prepare(
			`UPDATE decision SET notified_back_at = ?
       WHERE user_id = ? AND id = ? AND notified_back_at IS NULL`
		);
		const now = nowIso();
		const tx = db().transaction(() => {
			for (const id of ids) marks.run(now, userId, id);
		});
		tx();
	}
	return rows.map((row) => ({
		id: row.id,
		title: row.title,
		action: row.status,
		option: optionLabel(row.status),
		comment: row.answer_comment,
		answered_at: formatInZone(row.answered_epoch, timeZone()),
		epoch: row.answered_epoch
	}));
}

export function markAnswerNotified(userId: string, decisionId: string): void {
	db()
		.prepare(
			`UPDATE decision SET notified_back_at = ? WHERE user_id = ? AND id = ? AND notified_back_at IS NULL`
		)
		.run(nowIso(), userId, decisionId);
}

export function exportAll(userId: string): Record<string, unknown> {
	const user = db()
		.prepare(
			'SELECT id, display_name, created_at, updated_at, data_deleted_at, theme FROM user WHERE id = ?'
		)
		.get(userId);
	const credentials = db()
		.prepare(
			'SELECT id, device_type, backed_up, created_at, last_used_at FROM webauthn_credential WHERE user_id = ?'
		)
		.all(userId);
	const briefs = db().prepare('SELECT * FROM brief WHERE user_id = ? ORDER BY received_at').all(userId);
	const today = db().prepare('SELECT * FROM today_item WHERE user_id = ? ORDER BY updated_at').all(userId);
	const week = db().prepare('SELECT * FROM week_item WHERE user_id = ? ORDER BY updated_at').all(userId);
	const todos = db().prepare('SELECT * FROM todo WHERE user_id = ? ORDER BY sort_order').all(userId);
	const checklist = db()
		.prepare('SELECT * FROM checklist WHERE user_id = ? ORDER BY parent_kind, parent_id, sort_order')
		.all(userId);
	const stepComments = db()
		.prepare('SELECT * FROM step_comment WHERE user_id = ? ORDER BY parent_kind, parent_id, step_index')
		.all(userId);
	const planPhases = db().prepare('SELECT * FROM plan_phase WHERE user_id = ? ORDER BY sort_order').all(userId);
	const planMilestones = db()
		.prepare('SELECT * FROM plan_milestone WHERE user_id = ? ORDER BY phase_id, sort_order')
		.all(userId);
	const study = db().prepare('SELECT * FROM study_block WHERE user_id = ? ORDER BY updated_at').all(userId);
	const decisions = db().prepare('SELECT * FROM decision WHERE user_id = ?').all(userId);
	const events = db().prepare('SELECT * FROM decision_event WHERE user_id = ? ORDER BY at').all(userId);
	const meta = db().prepare('SELECT key, value, updated_at FROM screen_meta WHERE user_id = ?').all(userId);
	return {
		app: 'pokedex',
		exported_at: nowIso(),
		user,
		credentials,
		briefs,
		today,
		week,
		todos,
		checklist,
		step_comments: stepComments,
		plan_phases: planPhases,
		plan_milestones: planMilestones,
		study,
		decisions,
		decision_events: events,
		screen_meta: meta
	};
}

export function deleteUserData(userId: string, keepPasskey: boolean): void {
	const tx = db().transaction(() => {
		for (const table of [
			'step_comment',
			'decision_event',
			'decision',
			'study_block',
			'checklist',
			'todo',
			'week_item',
			'plan_milestone',
			'plan_phase',
			'today_item',
			'brief',
			'screen_meta',
			'push_subscription',
			'session',
			'auth_challenge'
		]) {
			db().prepare(`DELETE FROM ${table} WHERE user_id = ?`).run(userId);
		}
		if (!keepPasskey) {
			db().prepare('DELETE FROM webauthn_credential WHERE user_id = ?').run(userId);
			db().prepare('UPDATE user SET onboarding_done = 0, updated_at = ? WHERE id = ?').run(nowIso(), userId);
		} else {
			db()
				.prepare('UPDATE user SET data_deleted_at = ?, updated_at = ? WHERE id = ?')
				.run(nowIso(), nowIso(), userId);
		}
	});
	tx();
}
