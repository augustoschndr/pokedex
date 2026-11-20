import { currentTodos, listTicks } from '$lib/server/content';
import { allow, principalForToken } from '$lib/server/db';
import { clientKey, json, readBearer } from '$lib/server/http';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ request, url, locals, getClientAddress }) => {
	const token = readBearer(request);
	if (token) {
		let address = 'unknown';
		try {
			address = getClientAddress();
		} catch {
			address = 'unknown';
		}
		if (!allow(clientKey(address, 'todos-read'))) {
			return json({ ok: false, error: 'rate_limited' }, 429);
		}
		const principal = principalForToken(token);
		if (!principal?.scopes.includes('todos:read')) {
			return json({ ok: false, error: 'unauthorized' }, 401);
		}
		const since = url.searchParams.get('since');
		let sinceMs: number | null = null;
		if (since) {
			const parsed = Date.parse(since);
			if (Number.isNaN(parsed)) return json({ ok: false, error: 'invalid_since' }, 400);
			sinceMs = parsed;
		}
		const items = listTicks(principal.id, sinceMs).map(({ epoch: _epoch, ...item }) => item);
		return json({ items });
	}
	if (!locals.user) return json({ ok: false, error: 'unauthorized' }, 401);
	return json(currentTodos(locals.user.id));
};
