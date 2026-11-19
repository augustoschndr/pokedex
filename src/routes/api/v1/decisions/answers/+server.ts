import { listAnswers } from '$lib/server/content';
import { allow, principalForToken } from '$lib/server/db';
import { clientKey, json, readBearer } from '$lib/server/http';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ request, url, getClientAddress }) => {
	let address = 'unknown';
	try {
		address = getClientAddress();
	} catch {
		address = 'unknown';
	}
	if (!allow(clientKey(address, 'answers'))) {
		return json({ ok: false, error: 'rate_limited' }, 429);
	}
	const token = readBearer(request);
	const principal = token ? principalForToken(token) : null;
	if (!principal?.scopes.includes('decisions:read')) {
		return json({ ok: false, error: 'unauthorized' }, 401);
	}
	const since = url.searchParams.get('since');
	let sinceMs: number | null = null;
	if (since) {
		const parsed = Date.parse(since);
		if (Number.isNaN(parsed)) return json({ ok: false, error: 'invalid_since' }, 400);
		sinceMs = parsed;
	}
	const requested = Number(url.searchParams.get('limit') ?? 100);
	const limit = Math.min(Number.isFinite(requested) && requested > 0 ? requested : 100, 200);
	const answers = listAnswers(principal.id, sinceMs, limit).map(({ epoch: _epoch, ...answer }) => answer);
	return json({ answers });
};
