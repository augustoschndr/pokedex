import { clearSessionCookie, destroySession } from '$lib/server/auth';
import { deleteUserData } from '$lib/server/content';
import { issueFreshSetupCode } from '$lib/server/db';
import { json } from '$lib/server/http';
import { deleteSchema } from '$lib/server/schema';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ locals, request, cookies }) => {
	if (!locals.user) return json({ ok: false, error: 'unauthorized' }, 401);
	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return json({ ok: false, error: 'invalid_json' }, 400);
	}
	const parsed = deleteSchema.safeParse(body);
	if (!parsed.success) return json({ ok: false, error: 'confirm_required' }, 400);
	deleteUserData(locals.user.id, parsed.data.keep_passkey);
	destroySession(locals.sessionId);
	clearSessionCookie(cookies);
	if (!parsed.data.keep_passkey) issueFreshSetupCode(locals.user.id);
	return json({
		ok: true,
		redirect: parsed.data.keep_passkey ? '/login' : '/setup'
	});
};
