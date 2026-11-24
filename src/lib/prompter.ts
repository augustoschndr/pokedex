export const SPEED_KEY = 'pokedex.prompter.speed';
export const SPEED_MIN = 16;
export const SPEED_MAX = 120;
export const SPEED_DEFAULT = 48;

export function clampSpeed(value: unknown): number {
	if (value == null || value === '') return SPEED_DEFAULT;
	const raw = typeof value === 'number' ? value : Number(value);
	if (!Number.isFinite(raw)) return SPEED_DEFAULT;
	return Math.min(SPEED_MAX, Math.max(SPEED_MIN, Math.round(raw)));
}
