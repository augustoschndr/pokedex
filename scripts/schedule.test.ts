import assert from 'node:assert/strict';
import { test } from 'node:test';
import { chooseFocus, keepSchedule, reschedulePlan, effectiveDate, type ScheduleEntry } from '../src/lib/calendar.ts';
import { ingestSchema } from '../src/lib/server/schema.ts';

function entry(
	id: string,
	date: string,
	opts: { done?: boolean; order?: number; kind?: 'todo' | 'week' } = {}
): ScheduleEntry {
	return {
		id,
		kind: opts.kind ?? 'week',
		date,
		done: opts.done ?? false,
		order: opts.order ?? 0
	};
}

function apply(entries: ScheduleEntry[], today: string): ScheduleEntry[] {
	const moves = reschedulePlan(entries, today);
	return entries.map((entry) => {
		const move = moves.find((item) => item.id === entry.id && item.kind === entry.kind);
		return move ? { ...entry, date: move.date } : { ...entry };
	});
}

test('one lost day slides the remaining undone items forward in order', () => {
	const plan = [
		entry('a', '2026-11-23', { order: 0 }),
		entry('b', '2026-11-24', { order: 1 }),
		entry('c', '2026-11-25', { order: 2 })
	];
	const moves = reschedulePlan(plan, '2026-11-24');
	assert.deepEqual(
		moves.map((move) => [move.id, move.date]),
		[
			['a', '2026-11-24'],
			['b', '2026-11-25'],
			['c', '2026-11-26']
		]
	);
	assert.deepEqual(reschedulePlan(apply(plan, '2026-11-24'), '2026-11-24'), []);
});

test('several lost days pack undone items onto the next free days and drop nothing', () => {
	const plan = [
		entry('a', '2026-11-23', { order: 0 }),
		entry('b', '2026-11-24', { order: 1 }),
		entry('c', '2026-11-25', { order: 2 }),
		entry('d', '2026-11-26', { order: 3 }),
		entry('e', '2026-11-27', { order: 4 })
	];
	const moved = apply(plan, '2026-11-26');
	assert.deepEqual(
		moved.map((item) => item.date),
		['2026-11-26', '2026-11-27', '2026-11-28', '2026-11-29', '2026-11-30']
	);
	assert.equal(moved.length, plan.length);
	assert.deepEqual(reschedulePlan(moved, '2026-11-26'), []);
});

test('done items keep their dates and are never listed as moves', () => {
	const plan = [
		entry('a', '2026-11-23', { order: 0 }),
		entry('b', '2026-11-24', { order: 1, done: true }),
		entry('c', '2026-11-25', { order: 2 }),
		entry('task', '2026-11-25', { order: 1000, kind: 'todo' }),
		entry('d', '2026-11-27', { order: 3, done: true }),
		entry('e', '2026-11-26', { order: 4 })
	];
	const moves = reschedulePlan(plan, '2026-11-25');
	assert.deepEqual(
		moves.map((move) => [move.kind, move.id, move.date]),
		[
			['week', 'a', '2026-11-25'],
			['week', 'c', '2026-11-26'],
			['todo', 'task', '2026-11-28'],
			['week', 'e', '2026-11-29']
		]
	);
	const after = apply(plan, '2026-11-25');
	for (const item of plan.filter((row) => row.done)) {
		const next = after.find((row) => row.id === item.id && row.kind === item.kind);
		assert.equal(next?.date, item.date);
		assert.equal(next?.done, true);
	}
	assert.ok(!moves.some((move) => move.id === 'b' || move.id === 'd'));
	assert.deepEqual(reschedulePlan(after, '2026-11-25'), []);
});

test('a day that is not lost does not move future items', () => {
	const plan = [entry('a', '2026-11-24'), entry('b', '2026-11-25', { order: 1 })];
	assert.deepEqual(reschedulePlan(plan, '2026-11-24'), []);
});

test('keepSchedule leaves an override unless the payload sets a new date', () => {
	const shifted = { base: '2026-11-23', scheduled: '2026-11-24' };
	assert.deepEqual(keepSchedule(shifted, undefined, '2026-11-23-origin'), shifted);
	assert.deepEqual(keepSchedule(shifted, '2026-11-23', '2026-11-23-origin'), shifted);
	assert.deepEqual(keepSchedule(shifted, '2026-11-20', '2026-11-23-origin'), {
		base: '2026-11-20',
		scheduled: null
	});
	assert.deepEqual(keepSchedule(null, undefined, '2026-11-23-origin'), {
		base: '2026-11-23',
		scheduled: null
	});
	assert.deepEqual(keepSchedule({ base: null, scheduled: '2026-11-24' }, '2026-11-23', '2026-11-23-origin'), {
		base: '2026-11-23',
		scheduled: '2026-11-24'
	});
	assert.deepEqual(keepSchedule({ base: null, scheduled: '2026-12-05' }, undefined, 'open'), {
		base: null,
		scheduled: '2026-12-05'
	});
	assert.equal(effectiveDate('2026-11-23', '2026-11-24', '2026-11-23-origin'), '2026-11-24');
	assert.equal(effectiveDate('2026-11-23', null, '2026-11-23-origin'), '2026-11-23');
});

test('home picks today, otherwise the next upcoming item', () => {
	const items = [
		{ id: 'past', date: '2026-11-23', done: false, order: 0 },
		{ id: 'today-done', date: '2026-11-24', done: true, order: 1 },
		{ id: 'today-open', date: '2026-11-24', done: false, order: 2 },
		{ id: 'next', date: '2026-11-25', done: false, order: 3 }
	];
	assert.equal(chooseFocus(items, '2026-11-24')?.id, 'today-open');
	assert.equal(chooseFocus(items, '2026-11-24')?.when, 'today');
	const later = chooseFocus(
		items.filter((item) => item.id !== 'today-open'),
		'2026-11-24'
	);
	assert.equal(later?.id, 'today-done');
	assert.equal(later?.when, 'today');
	const upcoming = chooseFocus(
		items.filter((item) => !item.date.startsWith('2026-11-24')),
		'2026-11-24'
	);
	assert.equal(upcoming?.id, 'next');
	assert.equal(upcoming?.when, 'next');
	assert.equal(chooseFocus(items.filter((item) => item.id === 'past'), '2026-11-24'), null);
});

test('ingest accepts a real date and rejects one that is not a day', () => {
	const good = ingestSchema.safeParse({
		id: 'b',
		type: 'ad_hoc',
		todos: { items: [{ id: 'task', text: 'Call', date: '2026-12-01' }] }
	});
	assert.equal(good.success, true);
	const bad = ingestSchema.safeParse({
		id: 'b',
		type: 'ad_hoc',
		week: { items: [{ id: 'a', title: 'A', date: '2026-13-40' }] }
	});
	assert.equal(bad.success, false);
});
