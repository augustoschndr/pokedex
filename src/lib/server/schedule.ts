import { isoDateInZone } from '$lib/calendar';
import { effectiveDate, reschedulePlan, type ScheduleEntry } from '$lib/schedule';
import { db, getMeta, setMeta } from './db';
import { timeZone } from './env';

const STAMP = 'schedule_shifted_on';

type DatedRow = {
	id: string;
	base_date: string | null;
	scheduled_on: string | null;
	done: number;
	sort_order: number;
};

function loadEntries(userId: string): ScheduleEntry[] {
	const weeks = db()
		.prepare(
			`SELECT ingest_id AS id, base_date, scheduled_on, done, sort_order
       FROM week_item WHERE user_id = ? AND is_current = 1`
		)
		.all(userId) as DatedRow[];
	const todos = db()
		.prepare(
			`SELECT id, base_date, scheduled_on, done, sort_order
       FROM todo WHERE user_id = ? AND archived = 0`
		)
		.all(userId) as DatedRow[];
	const entries: ScheduleEntry[] = [];
	for (const row of weeks) {
		const date = effectiveDate(row.base_date, row.scheduled_on, row.id);
		if (!date) continue;
		entries.push({ id: row.id, kind: 'week', date, done: row.done === 1, order: row.sort_order });
	}
	for (const row of todos) {
		const date = effectiveDate(row.base_date, row.scheduled_on, row.id);
		if (!date) continue;
		entries.push({
			id: row.id,
			kind: 'todo',
			date,
			done: row.done === 1,
			order: 1000 + row.sort_order
		});
	}
	return entries;
}

/**
 * Persist one reshuffle for this calendar day. Later calls the same day do nothing
 * unless `force` (used after ingest, so a new overdue plan still slides).
 * Writes `scheduled_on` only, and only on rows that are still not done.
 */
export function shiftSchedule(userId: string, now = Date.now(), opts?: { force?: boolean }): number {
	const today = isoDateInZone(now, timeZone());
	if (!opts?.force && getMeta(userId, STAMP) === today) return 0;
	const moves = reschedulePlan(loadEntries(userId), today);
	const run = db().transaction(() => {
		const week = db().prepare(
			`UPDATE week_item SET scheduled_on = ?
       WHERE user_id = ? AND ingest_id = ? AND is_current = 1 AND done = 0`
		);
		const todo = db().prepare(
			`UPDATE todo SET scheduled_on = ?
       WHERE user_id = ? AND id = ? AND archived = 0 AND done = 0`
		);
		for (const move of moves) {
			if (move.kind === 'week') week.run(move.date, userId, move.id);
			else todo.run(move.date, userId, move.id);
		}
		setMeta(userId, STAMP, today, '');
	});
	run();
	return moves.length;
}
