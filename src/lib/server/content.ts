import { randomId } from './crypto';
import { db, getMeta } from './db';
import { timeZone } from './env';
import { formatInZone, nowIso, nowMs } from './time';
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
			`SELECT ingest_id, lead, title, detail, meta, status_label, status_tone
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
	}[];
	return {
		intro: getMeta(userId, 'week_intro'),
		items: rows.map((row) => ({
			id: row.ingest_id,
			lead: row.lead,
			title: row.title,
			detail: row.detail,
			meta: row.meta,
			status: row.status_label ? { label: row.status_label, tone: row.status_tone ?? 'default' } : null
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
	const doneAt = done ? nowIso() : null;
	db()
		.prepare('UPDATE todo SET done = ?, done_at = ?, updated_at = ? WHERE user_id = ? AND id = ?')
		.run(done, doneAt, nowIso(), userId, id);
	return { id: row.id, text: row.text, meta: row.meta, done: done === 1, done_at: doneAt };
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
		.prepare('SELECT id, display_name, created_at, updated_at, data_deleted_at FROM user WHERE id = ?')
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
			'todo',
			'week_item',
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
