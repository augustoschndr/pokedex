import { allow, principalForToken } from '$lib/server/db';
import { clientKey, json, readBearer } from '$lib/server/http';
import { pushToUser } from '$lib/server/push';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ locals, request, getClientAddress }) => {
	let address = 'unknown';
	try {
		address = getClientAddress();
	} catch {
		address = 'unknown';
	}
	if (!allow(clientKey(address, 'push-test'))) {
		return json({ ok: false, error: 'rate_limited' }, 429);
	}
	const token = readBearer(request);
	const principal = token ? principalForToken(token) : null;
	const userId = principal?.scopes.includes('ingest:write') ? principal.id : locals.user?.id;
	if (!userId) return json({ ok: false, error: 'unauthorized' }, 401);
	const report = await pushToUser(userId, {
		title: 'Pokedex',
		body: 'Test notification',
		url: '/today'
	});
	if (report.error) return json({ ok: false, error: report.error, pushed: 0, results: [] }, 503);
	return json({ ok: true, pushed: report.sent, results: report.results });
};
