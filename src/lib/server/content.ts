import { randomId } from './crypto';
import { db, getMeta } from './db';
import { timeZone } from './env';
import { formatInZone, nowIso, nowMs } from './time';
import type { Guide } from '$lib/types';
import type { Diagram, StudyBlock } from '$lib/types';

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
};

export type TodoView = {
	id: string;
	text: string;
	meta: string | null;
	done: boolean;
	done_at: string | null;
};

export type StudyBlockView = StudyBlock;

export type DecisionView = {
	id: string;
	title: string;
	detail: string | null;
	status: string;
	comment: string | null;
	answered_at: string | null;
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
	plan: { id: string; title: string; kind: 'phase' | 'milestone' } | null;
	back: string;
};

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
	const milestone = db()
		.prepare('SELECT id, title FROM plan_milestone WHERE user_id = ? AND id = ?')
		.get(userId, ref) as { id: string; title: string } | undefined;
	if (milestone) return { id: milestone.id, title: milestone.title, kind: 'milestone' };
	const phase = db()
		.prepare('SELECT id, title FROM plan_phase WHERE user_id = ? AND id = ?')
		.get(userId, ref) as { id: string; title: string } | undefined;
	if (phase) return { id: phase.id, title: phase.title, kind: 'phase' };
	return null;
}

export function getTask(userId: string, kind: 'todo' | 'week', id: string): TaskView | null {
	if (kind === 'todo') {
		const row = db()
			.prepare(
				`SELECT id, text, meta, done, guide_json FROM todo WHERE user_id = ? AND id = ? AND archived = 0`
			)
			.get(userId, id) as
			| { id: string; text: string; meta: string | null; done: number; guide_json: string | null }
			| undefined;
		if (!row) return null;
		const guide = readGuide(row.guide_json);
		return {
			kind: 'todo',
			id: row.id,
			title: row.text,
			detail: null,
			meta: row.meta,
			lead: null,
			status: null,
			done: row.done === 1,
			guide,
			checklist: checklistFor(userId, 'todo', row.id),
			plan: planLabel(userId, guide?.plan_ref),
			back: '/you'
		};
	}
	const row = db()
		.prepare(
			`SELECT ingest_id, lead, title, detail, meta, status_label, status_tone, done, guide_json
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
		  }
		| undefined;
	if (!row) return null;
	const guide = readGuide(row.guide_json);
	return {
		kind: 'week',
		id: row.ingest_id,
		title: row.title,
		detail: row.detail,
		meta: row.meta,
		lead: row.lead,
		status: row.status_label ? { label: row.status_label, tone: row.status_tone ?? 'default' } : null,
		done: row.done === 1,
		guide,
		checklist: checklistFor(userId, 'week', row.ingest_id),
		plan: planLabel(userId, guide?.plan_ref),
		back: '/week'
	};
}

export type PlanTask = { kind: 'todo' | 'week'; id: string; title: string; done: boolean };

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
	const tasks = linkedTasks(userId);
	const byRef = new Map<string, PlanTask[]>();
	for (const task of tasks) {
		const list = byRef.get(task.ref) ?? [];
		list.push({ kind: task.kind, id: task.id, title: task.title, done: task.done });
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

export type TickRecord = {
	id: string;
	parent_id: string | null;
	parent_kind: 'todo' | 'week' | null;
	kind: 'todo' | 'week' | 'checklist';
	done: boolean;
	done_at: string | null;
	epoch: number | null;
};

export function listTicks(userId: string, sinceMs: number | null): TickRecord[] {
	const todos = db()
		.prepare(
			`SELECT id, done, done_at, status_epoch FROM todo
       WHERE user_id = ? AND archived = 0 AND (? IS NULL OR status_epoch >= ?)
       ORDER BY status_epoch ASC, id ASC`
		)
		.all(userId, sinceMs, sinceMs) as {
		id: string;
		done: number;
		done_at: string | null;
		status_epoch: number | null;
	}[];
	const week = db()
		.prepare(
			`SELECT ingest_id, done, done_at, status_epoch FROM week_item
       WHERE user_id = ? AND is_current = 1 AND (? IS NULL OR status_epoch >= ?)
       ORDER BY status_epoch ASC, ingest_id ASC`
		)
		.all(userId, sinceMs, sinceMs) as {
		ingest_id: string;
		done: number;
		done_at: string | null;
		status_epoch: number | null;
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
	const records: TickRecord[] = [
		...todos.map((row) => ({
			id: row.id,
			parent_id: null,
			parent_kind: null,
			kind: 'todo' as const,
			done: row.done === 1,
			done_at: presentDoneAt(row.done_at),
			epoch: row.status_epoch
		})),
		...week.map((row) => ({
			id: row.ingest_id,
			parent_id: null,
			parent_kind: null,
			kind: 'week' as const,
			done: row.done === 1,
			done_at: presentDoneAt(row.done_at),
			epoch: row.status_epoch
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
	return records.sort((a, b) => (a.epoch ?? -1) - (b.epoch ?? -1) || a.kind.localeCompare(b.kind) || a.id.localeCompare(b.id));
}

export function currentToday(userId: string): TodayView | null {
	const row = db()
		.prepare(
			`SELECT * FROM today_item WHERE user_id = ? AND is_current = 1 ORDER BY updated_at DESC LIMIT 1`
		)
		.get(userId) as Record<string, unknown> | undefined;
	if (!row) return null;
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

export function currentWeek(userId: string): { intro: string; items: WeekItemView[] } {
	const rows = db()
		.prepare(
			`SELECT ingest_id, lead, title, detail, meta, status_label, status_tone, done, guide_json
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
			duration: readGuide(row.guide_json)?.duration ?? null
		}))
	};
}

export function currentTodos(userId: string): { intro: string; items: TodoView[] } {
	const rows = db()
		.prepare(
			`SELECT id, text, meta, done, done_at FROM todo
       WHERE user_id = ? AND archived = 0 ORDER BY sort_order ASC, id ASC`
		)
		.all(userId) as {
		id: string;
		text: string;
		meta: string | null;
		done: number;
		done_at: string | null;
	}[];
	return {
		intro: getMeta(userId, 'todos_intro'),
		items: rows.map((row) => ({
			id: row.id,
			text: row.text,
			meta: row.meta,
			done: row.done === 1,
			done_at: row.done_at
		}))
	};
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
		answered_at: row.answered_epoch ? formatInZone(row.answered_epoch, timeZone()) : null
	}));
}

export function pendingDecisionCount(userId: string): number {
	const row = db()
		.prepare(`SELECT COUNT(*) AS c FROM decision WHERE user_id = ? AND status = 'pending'`)
		.get(userId) as { c: number };
	return row.c;
}

export function toggleTodo(userId: string, id: string): TodoView | null {
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

export type AnswerRecord = {
	id: string;
	title: string;
	action: 'approved' | 'rejected' | 'commented';
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
