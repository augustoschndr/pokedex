export const TAB_HREFS = ['/today', '/week', '/you', '/study', '/decisions'] as const;

export type TabHref = (typeof TAB_HREFS)[number];

export function isTab(path: string): path is TabHref {
	return (TAB_HREFS as readonly string[]).includes(path);
}

/** direction 1 is the next tab (finger moved left). */
export function neighbor(path: string, direction: -1 | 1): TabHref | null {
	const index = (TAB_HREFS as readonly string[]).indexOf(path);
	if (index < 0) return null;
	return TAB_HREFS[index + direction] ?? null;
}

/** How far the page follows a finger. Past the first or last tab, it resists. */
export function follow(dx: number, width: number, atStart: boolean, atEnd: boolean): number {
	if (atStart && dx > 0) return Math.min(dx * 0.3, width * 0.35);
	if (atEnd && dx < 0) return Math.max(dx * 0.3, -width * 0.35);
	return Math.max(-width, Math.min(width, dx));
}

/**
 * 1 commits toward the next tab, -1 toward the previous, 0 snaps back.
 * Velocity is px/ms; a short flick counts as well as a long drag.
 */
export function commitDirection(dx: number, width: number, velocity: number): -1 | 0 | 1 {
	const dist = Math.max(48, width * 0.22);
	const score = dx + velocity * 140;
	if (score <= -dist) return 1;
	if (score >= dist) return -1;
	return 0;
}
