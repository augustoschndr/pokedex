/** Apple rejects any other subject with 403 BadJwtToken. */
export function validVapidSubject(value: string): boolean {
	try {
		const url = new URL(value);
		if (url.protocol === 'mailto:') return url.pathname.includes('@');
		if (url.protocol === 'https:') return url.hostname !== '' && url.hostname !== 'localhost';
		return false;
	} catch {
		return false;
	}
}

/** 404 and 410 mean the browser dropped the subscription. 403 and 413 do not. */
export function outcomeFromStatus(status: number): { ok: boolean; drop: boolean } {
	return { ok: status >= 200 && status < 300, drop: status === 404 || status === 410 };
}
