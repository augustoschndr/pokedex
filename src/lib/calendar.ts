const WEEKDAYS_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const WEEKDAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function parseIso(iso: string): { y: number; m: number; d: number } {
	const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
	if (!match) throw new Error(`bad date: ${iso}`);
	return { y: Number(match[1]), m: Number(match[2]), d: Number(match[3]) };
}

export function toIso(y: number, m: number, d: number): string {
	const date = new Date(Date.UTC(y, m - 1, d));
	const yy = date.getUTCFullYear();
	const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
	const dd = String(date.getUTCDate()).padStart(2, '0');
	return `${yy}-${mm}-${dd}`;
}

export function isIsoDate(value: string): boolean {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
	const { y, m, d } = parseIso(value);
	return toIso(y, m, d) === value;
}

/** Calendar date in a zone, as YYYY-MM-DD. */
export function isoDateInZone(ms: number, timeZone: string): string {
	const fmt = new Intl.DateTimeFormat('en-US', {
		timeZone,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit'
	});
	const parts = Object.fromEntries(fmt.formatToParts(new Date(ms)).map((part) => [part.type, part.value]));
	return `${parts.year}-${parts.month}-${parts.day}`;
}

export function addDays(iso: string, days: number): string {
	const { y, m, d } = parseIso(iso);
	return toIso(y, m, d + days);
}

export function diffDays(from: string, to: string): number {
	const a = parseIso(from);
	const b = parseIso(to);
	const ms = Date.UTC(b.y, b.m - 1, b.d) - Date.UTC(a.y, a.m - 1, a.d);
	return Math.round(ms / 86_400_000);
}

export function weekdayIndex(iso: string): number {
	const { y, m, d } = parseIso(iso);
	return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** Monday-start week. */
export function startOfWeek(iso: string): string {
	const index = weekdayIndex(iso);
	const delta = index === 0 ? -6 : 1 - index;
	return addDays(iso, delta);
}

export function endOfWeek(iso: string): string {
	return addDays(startOfWeek(iso), 6);
}

export function eachDay(from: string, to: string): string[] {
	const days: string[] = [];
	let cursor = from;
	while (cursor <= to) {
		days.push(cursor);
		cursor = addDays(cursor, 1);
		if (days.length > 370) break;
	}
	return days;
}

export function formatLong(iso: string): string {
	const { m, d } = parseIso(iso);
	return `${WEEKDAYS_LONG[weekdayIndex(iso)]}, ${MONTHS[m - 1]} ${d}`;
}

export function formatShort(iso: string): string {
	const { m, d } = parseIso(iso);
	return `${WEEKDAYS_SHORT[weekdayIndex(iso)]}, ${MONTHS[m - 1]} ${d}`;
}

export function formatDayNum(iso: string): string {
	const { d } = parseIso(iso);
	return `${WEEKDAYS_SHORT[weekdayIndex(iso)]} ${d}`;
}

/** "Mon, Nov 23 — in 4 days" / "Mon, Nov 23 — tomorrow". */
export function countdownPhrase(today: string, brief: string): string {
	const days = diffDays(today, brief);
	const when = formatShort(brief);
	if (days === 1) return `${when} — tomorrow`;
	if (days > 1) return `${when} — in ${days} days`;
	return when;
}

/** Shot ids in the ingest samples are prefixed with the calendar date. */
export function dateFromId(id: string): string | null {
	const match = /^(\d{4}-\d{2}-\d{2})(?:$|[-_.])/.exec(id);
	if (!match || !isIsoDate(match[1])) return null;
	return match[1];
}

export type DayRelation = 'past' | 'today' | 'future';

export function relation(date: string, today: string): DayRelation {
	if (date < today) return 'past';
	if (date > today) return 'future';
	return 'today';
}

export function calendarSpan(today: string, shotDates: string[]): { start: string; end: string } {
	const dated = shotDates.filter(isIsoDate);
	const earliest = dated.reduce((min, date) => (date < min ? date : min), today);
	const latest = dated.reduce((max, date) => (date > max ? date : max), today);
	return {
		start: startOfWeek(earliest < today ? earliest : today),
		end: endOfWeek(latest > today ? latest : today)
	};
}

export type ScheduleEntry = {
	id: string;
	kind: 'todo' | 'week';
	date: string;
	done: boolean;
	order: number;
};

export type ScheduleMove = {
	id: string;
	kind: 'todo' | 'week';
	from: string;
	date: string;
};

/** Effective day the phone shows. The override wins, then the stored plan date, then a date prefix on the id. */
export function effectiveDate(base: string | null, override: string | null, id: string): string | null {
	if (override && isIsoDate(override)) return override;
	if (base && isIsoDate(base)) return base;
	return dateFromId(id);
}

/** The day the plan gave this item, before any slide. */
export function planDate(base: string | null, id: string): string | null {
	if (base && isIsoDate(base)) return base;
	return dateFromId(id);
}

/** True when a reschedule override moved the item off its plan day. */
export function isSlipped(base: string | null, scheduled: string | null, id: string): boolean {
	const plan = planDate(base, id);
	return Boolean(scheduled && isIsoDate(scheduled) && plan && scheduled !== plan);
}

/**
 * Plan date and reschedule override after an ingest.
 * Omitting `date`, or sending the same plan date again, keeps the override.
 * A different `date` is a new plan and clears the override.
 */
export function keepSchedule(
	prior: { base: string | null; scheduled: string | null } | null,
	explicit: string | undefined,
	id: string
): { base: string | null; scheduled: string | null } {
	const derived = dateFromId(id);
	const previousBase = prior ? (prior.base && isIsoDate(prior.base) ? prior.base : derived) : null;
	const sent = explicit !== undefined && isIsoDate(explicit) ? explicit : undefined;
	if (!prior) return { base: sent ?? derived, scheduled: null };
	if (sent === undefined || sent === previousBase) {
		return { base: previousBase, scheduled: prior.scheduled };
	}
	return { base: sent, scheduled: null };
}

/**
 * Slide undone items onto the next free days, starting today, in plan order.
 * A free day does not already hold a done item dated today or later.
 * Done items are never returned. A second call on the result is empty.
 */
export function reschedulePlan(entries: ScheduleEntry[], today: string): ScheduleMove[] {
	if (!isIsoDate(today)) return [];
	const dated = entries.filter((entry) => isIsoDate(entry.date));
	if (!dated.some((entry) => !entry.done && entry.date < today)) return [];

	const occupied = new Set<string>();
	for (const entry of dated) {
		if (entry.done && entry.date >= today) occupied.add(entry.date);
	}

	const undone = dated
		.filter((entry) => !entry.done)
		.sort(
			(a, b) =>
				a.date.localeCompare(b.date) || a.order - b.order || a.kind.localeCompare(b.kind) || a.id.localeCompare(b.id)
		);

	const moves: ScheduleMove[] = [];
	let cursor = today;
	for (const entry of undone) {
		let guard = 0;
		while (occupied.has(cursor)) {
			cursor = addDays(cursor, 1);
			if (++guard > 400) return moves;
		}
		occupied.add(cursor);
		if (entry.date !== cursor) moves.push({ id: entry.id, kind: entry.kind, from: entry.date, date: cursor });
		cursor = addDays(cursor, 1);
	}
	return moves;
}

export type FocusChoice<T> = T & { when: 'today' | 'next' };

/** Today's open item, else today's item, else the next day's open item. Past days are skipped. */
export function chooseFocus<T extends { id: string; date: string; done: boolean; order: number }>(
	items: T[],
	today: string
): FocusChoice<T> | null {
	if (!isIsoDate(today)) return null;
	const dated = items.filter((item) => isIsoDate(item.date));
	const pick = (rows: T[]): T | null => {
		if (!rows.length) return null;
		const open = rows.filter((row) => !row.done);
		const pool = open.length ? open : rows;
		return [...pool].sort((a, b) => a.order - b.order || a.id.localeCompare(b.id))[0] ?? null;
	};
	const todayPick = pick(dated.filter((item) => item.date === today));
	if (todayPick) return { ...todayPick, when: 'today' };
	const upcoming = dated
		.filter((item) => item.date > today)
		.sort((a, b) => a.date.localeCompare(b.date) || a.order - b.order || a.id.localeCompare(b.id));
	if (!upcoming.length) return null;
	const nextDate = upcoming[0].date;
	const next = pick(upcoming.filter((item) => item.date === nextDate));
	return next ? { ...next, when: 'next' } : null;
}
