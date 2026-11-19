import { timeZone } from './env';

export function nowIso(): string {
	return new Date().toISOString();
}

export function nowMs(): number {
	return Date.now();
}

/** Format an instant as ISO-8601 with the zone's numeric offset, e.g. 2026-11-20T10:15:00-03:00. */
export function formatInZone(ms: number, zone = timeZone()): string {
	const date = new Date(ms);
	const fmt = new Intl.DateTimeFormat('en-US', {
		timeZone: zone,
		hourCycle: 'h23',
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit'
	});
	const parts = Object.fromEntries(fmt.formatToParts(date).map((part) => [part.type, part.value]));
	const hour = parts.hour === '24' ? '00' : parts.hour;
	const asUtc = Date.UTC(
		Number(parts.year),
		Number(parts.month) - 1,
		Number(parts.day),
		Number(hour),
		Number(parts.minute),
		Number(parts.second)
	);
	const offsetMin = Math.round((asUtc - date.getTime()) / 60000);
	const sign = offsetMin >= 0 ? '+' : '-';
	const abs = Math.abs(offsetMin);
	const oh = String(Math.floor(abs / 60)).padStart(2, '0');
	const om = String(abs % 60).padStart(2, '0');
	return `${parts.year}-${parts.month}-${parts.day}T${hour}:${parts.minute}:${parts.second}${sign}${oh}:${om}`;
}
