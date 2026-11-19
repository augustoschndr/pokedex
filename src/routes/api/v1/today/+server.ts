import { currentToday } from '$lib/server/content';
import { json } from '$lib/server/http';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ locals }) => {
	if (!locals.user) return json({ ok: false, error: 'unauthorized' }, 401);
	return json({ today: currentToday(locals.user.id) });
};
