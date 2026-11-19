import { toggleTodo } from '$lib/server/content';
import { json } from '$lib/server/http';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = ({ locals, params }) => {
	if (!locals.user) return json({ ok: false, error: 'unauthorized' }, 401);
	const item = toggleTodo(locals.user.id, params.id);
	if (!item) return json({ ok: false, error: 'not_found' }, 404);
	return json({ ok: true, item });
};
