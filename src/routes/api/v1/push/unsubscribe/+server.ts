import { json } from '$lib/server/http';
import { removeSubscription } from '$lib/server/push';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ locals, request }) => {
	if (!locals.user) return json({ ok: false, error: 'unauthorized' }, 401);
	let body: { endpoint?: string };
	try {
		body = (await request.json()) as { endpoint?: string };
	} catch {
		return json({ ok: false, error: 'invalid_json' }, 400);
	}
	if (!body.endpoint) return json({ ok: false, error: 'invalid_payload' }, 400);
	removeSubscription(locals.user.id, body.endpoint);
	return json({ ok: true });
};
