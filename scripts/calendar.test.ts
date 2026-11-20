import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
	calendarSpan,
	countdownPhrase,
	dateFromId,
	diffDays,
	eachDay,
	formatLong,
	relation,
	startOfWeek
} from '../src/lib/calendar.ts';

test('Nov 19 2026 is a Thursday, four days before the Monday brief', () => {
	assert.equal(formatLong('2026-11-19'), 'Thursday, Nov 19');
	assert.equal(diffDays('2026-11-19', '2026-11-23'), 4);
	assert.equal(countdownPhrase('2026-11-19', '2026-11-23'), 'Mon, Nov 23 — in 4 days');
	assert.equal(countdownPhrase('2026-11-22', '2026-11-23'), 'Mon, Nov 23 — tomorrow');
});

test('shot dates come from the id, not a made-up weekday', () => {
	assert.equal(dateFromId('2026-11-23-origin'), '2026-11-23');
	assert.equal(dateFromId('2026-11-27-abrasom'), '2026-11-27');
	assert.equal(dateFromId('cf-cal'), null);
	assert.equal(dateFromId('2026-13-40-nope'), null);
});

test('the week span covers this week and the upcoming shoot week', () => {
	const span = calendarSpan('2026-11-19', [
		'2026-11-23',
		'2026-11-24',
		'2026-11-25',
		'2026-11-26',
		'2026-11-27'
	]);
	assert.equal(span.start, '2026-11-16');
	assert.equal(startOfWeek('2026-11-19'), '2026-11-16');
	assert.equal(span.end, '2026-11-29');
	const days = eachDay(span.start, span.end);
	assert.equal(days[0], '2026-11-16');
	assert.equal(days.at(-1), '2026-11-29');
	assert.equal(relation('2026-11-18', '2026-11-19'), 'past');
	assert.equal(relation('2026-11-19', '2026-11-19'), 'today');
	assert.equal(relation('2026-11-23', '2026-11-19'), 'future');
});
