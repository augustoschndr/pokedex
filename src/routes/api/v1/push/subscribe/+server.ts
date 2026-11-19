import { json } from '$lib/server/http';
import { saveSubscription } from '$lib/server/push';
import { pushSubSchema } from '$lib/server/schema';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ locals, request }) => {
	if (!locals.user) return json({ ok: false, error: 'unauthorized' }, 401);
	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return json({ ok: false, error: 'invalid_json' }, 400);
	}
	const parsed = pushSubSchema.safeParse(body);
	if (!parsed.success) return json({ ok: false, error: 'invalid_payload' }, 400);
	saveSubscription(
		locals.user.id,
		parsed.data.endpoint,
		parsed.data.keys.p256dh,
		parsed.data.keys.auth,
		request.headers.get('user-agent')
	);
	return json({ ok: true });
};
