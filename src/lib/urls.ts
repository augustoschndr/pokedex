/** http(s) only, with no embedded credentials. Returns the normalized href. */
export function safeHttpUrl(value: string): string | null {
	try {
		const url = new URL(value);
		if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
		if (url.username || url.password) return null;
		return url.href;
	} catch {
		return null;
	}
}
