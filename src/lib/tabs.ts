export const TAB_HREFS = ['/today', '/week', '/you', '/study', '/decisions'] as const;

export type TabHref = (typeof TAB_HREFS)[number];

export function isTab(path: string): path is TabHref {
	return (TAB_HREFS as readonly string[]).includes(path);
}

/** A tab root, or the tab that owns a detail route such as /you/:id. */
export function tabRoot(path: string): TabHref | null {
	if (isTab(path)) return path;
	for (const href of TAB_HREFS) {
		if (path.startsWith(`${href}/`)) return href;
	}
	return null;
}

export function tabIndex(path: string): number {
	const root = tabRoot(path);
	return root ? TAB_HREFS.indexOf(root) : -1;
}

export function showsTabs(path: string): boolean {
	return tabRoot(path) !== null;
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

/**
 * One step of an underdamped spring. Offset is in px, velocity in px/s, dt in seconds.
 * The settle keeps the release speed when it points at the target and drops it when it does not.
 */
export function aimedVelocity(offset: number, target: number, velocityPxPerMs: number): number {
	const perSecond = velocityPxPerMs * 1000;
	if ((target - offset) * perSecond < 0) return 0;
	return perSecond;
}

export function stepSpring(
	offset: number,
	target: number,
	velocity: number,
	dt: number
): { offset: number; velocity: number; settled: boolean } {
	const step = Math.min(Math.max(dt, 0), 0.032);
	const stiffness = 420;
	const damping = 32;
	const nextVelocity = velocity + (-stiffness * (offset - target) - damping * velocity) * step;
	const next = offset + nextVelocity * step;
	const settled = Math.abs(next - target) < 0.5 && Math.abs(nextVelocity) < 40;
	return settled
		? { offset: target, velocity: 0, settled: true }
		: { offset: next, velocity: nextVelocity, settled: false };
}
