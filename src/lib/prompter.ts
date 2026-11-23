export const SPEED_KEY = 'pokedex.prompter.speed';
export const SPEED_MIN = 16;
export const SPEED_MAX = 120;
export const SPEED_DEFAULT = 48;

const MIME_TYPES = [
	'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
	'video/mp4',
	'video/webm;codecs=vp9,opus',
	'video/webm;codecs=vp8,opus',
	'video/webm'
];

export function clampSpeed(value: unknown): number {
	if (value == null || value === '') return SPEED_DEFAULT;
	const raw = typeof value === 'number' ? value : Number(value);
	if (!Number.isFinite(raw)) return SPEED_DEFAULT;
	return Math.min(SPEED_MAX, Math.max(SPEED_MIN, Math.round(raw)));
}

/** Prefer mp4 so an iPhone can save the take, then the common WebM types. */
export function pickRecorderMime(supported: (type: string) => boolean): string {
	return MIME_TYPES.find((type) => supported(type)) ?? '';
}

export function recordingExtension(mime: string): string {
	return mime.includes('webm') ? 'webm' : 'mp4';
}

export function cameraErrorMessage(name: string): string {
	if (name === 'NotAllowedError' || name === 'PermissionDeniedError' || name === 'SecurityError') {
		return 'Camera access is off. Allow the camera for Pokedex in Settings, then try again.';
	}
	if (name === 'NotFoundError' || name === 'DevicesNotFoundError' || name === 'OverconstrainedError') {
		return 'No front camera was found on this phone.';
	}
	return 'The camera could not start.';
}

export function micErrorMessage(name: string): string {
	if (name === 'NotAllowedError' || name === 'PermissionDeniedError' || name === 'SecurityError') {
		return 'Microphone access is off. Allow the microphone to record with sound.';
	}
	if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
		return 'No microphone was found, so this take cannot include sound.';
	}
	return 'The microphone could not start.';
}

export function formatClock(ms: number): string {
	const total = Math.max(0, Math.floor(ms / 1000));
	const minutes = Math.floor(total / 60);
	const seconds = total % 60;
	return `${minutes}:${String(seconds).padStart(2, '0')}`;
}
