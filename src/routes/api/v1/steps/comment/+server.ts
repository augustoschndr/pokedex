import { z } from 'zod';
import { saveStepComment } from '$lib/server/content';
import { json } from '$lib/server/http';
import type { RequestHandler } from './$types';

const bodySchema = z.object({
	parent_kind: z.enum(['todo', 'week']),
	parent_id: z.string().min(1).max(200),
	index: z.number().int().min(0).max(39),
	text: z.string().max(2000)
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
	const saved = saveStepComment(
		locals.user.id,
		parsed.data.parent_kind,
		parsed.data.parent_id,
		parsed.data.index,
		parsed.data.text
	);
	if (!saved) return json({ ok: false, error: 'not_found' }, 404);
	return json({ ok: true, step: saved.step });
};
