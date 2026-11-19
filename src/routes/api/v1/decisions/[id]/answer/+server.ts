import { answerDecision } from '$lib/server/content';
import { json } from '$lib/server/http';
import { answerSchema } from '$lib/server/schema';
import { deliverAnswer } from '$lib/server/webhook';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ locals, params, request }) => {
	if (!locals.user) return json({ ok: false, error: 'unauthorized' }, 401);
	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return json({ ok: false, error: 'invalid_json' }, 400);
	}
	const parsed = answerSchema.safeParse(body);
	if (!parsed.success) return json({ ok: false, error: 'invalid_payload' }, 400);
	const comment = parsed.data.comment?.trim() ?? '';
	if (parsed.data.action === 'commented' && !comment) {
		return json({ ok: false, error: 'comment_required' }, 400);
	}
	const answer = answerDecision(locals.user.id, params.id, parsed.data.action, comment || null);
	if (!answer) return json({ ok: false, error: 'not_found' }, 404);
	deliverAnswer(locals.user.id, answer);
	const { epoch: _epoch, ...publicAnswer } = answer;
	return json({ ok: true, answer: publicAnswer });
};
