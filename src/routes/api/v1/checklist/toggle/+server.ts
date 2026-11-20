import { z } from 'zod';
import { toggleChecklist } from '$lib/server/content';
import { json } from '$lib/server/http';
import type { RequestHandler } from './$types';

const bodySchema = z.object({
	parent_kind: z.enum(['todo', 'week']),
	parent_id: z.string().min(1).max(200),
	id: z.string().min(1).max(200)
});

export const POST: RequestHandler = async ({ locals, request }) => {
	if (!locals.user) return json({ ok: false, error: 'unauthorized' }, 401);
	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return json({ ok: false, error: 'invalid_json' }, 400);
	}
	const parsed = bodySchema.safeParse(body);
	if (!parsed.success) return json({ ok: false, error: 'invalid_payload' }, 400);
	const item = toggleChecklist(locals.user.id, parsed.data.parent_kind, parsed.data.parent_id, parsed.data.id);
	if (!item) return json({ ok: false, error: 'not_found' }, 404);
	return json({ ok: true, item });
};
