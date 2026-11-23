export const SPEED_KEY = 'pokedex.prompter.speed';
export const SPEED_MIN = 16;
export const SPEED_MAX = 120;
export const SPEED_DEFAULT = 48;

const MIME_TYPES = [
	'video/mp4;codecs=avc1',
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

export function takeFileName(when: Date, extension = 'mp4'): string {
	const pad = (value: number) => String(value).padStart(2, '0');
	return `pokedex-${when.getFullYear()}${pad(when.getMonth() + 1)}${pad(when.getDate())}-${pad(when.getHours())}${pad(when.getMinutes())}.${extension}`;
}

/** Build a file from timeslice chunks already in hand. An empty buffer is not a take. */
export function takeFromChunks(chunks: Blob[], mime: string, when = new Date()): File | null {
	if (!chunks.some((chunk) => chunk.size > 0)) return null;
	const type = (mime || 'video/mp4').split(';')[0] || 'video/mp4';
	const extension = type.includes('webm') ? 'webm' : 'mp4';
	const blob = new Blob(chunks, { type });
	if (blob.size === 0) return null;
	return new File([blob], takeFileName(when, extension), { type });
}

export type ShareOutcome = 'shared' | 'abort' | 'button';

/**
 * Call `share` before any await so a tap can still open the iOS sheet.
 * AbortError is the user closing that sheet. Anything else needs another tap.
 */
export function shareRecording(
	file: File,
	share: (data: { files: File[]; title?: string }) => Promise<void>,
	canShare?: (data: { files: File[]; title?: string }) => boolean,
	title?: string
): Promise<ShareOutcome> {
	const payload = { files: [file], title };
	if (canShare && !canShare(payload)) return Promise.resolve('button');
	try {
		return share(payload).then(
			() => 'shared' as const,
			(error: unknown) => {
				if (error instanceof DOMException && error.name === 'AbortError') return 'abort';
				return 'button';
			}
		);
	} catch (error) {
		if (error instanceof DOMException && error.name === 'AbortError') return Promise.resolve('abort');
		return Promise.resolve('button');
	}
}

export function formatClock(ms: number): string {
	const total = Math.max(0, Math.floor(ms / 1000));
	const minutes = Math.floor(total / 60);
	const seconds = total % 60;
	return `${minutes}:${String(seconds).padStart(2, '0')}`;
}
