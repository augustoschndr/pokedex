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
