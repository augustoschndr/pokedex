import { clearSessionCookie, destroySession } from '$lib/server/auth';
import { json } from '$lib/server/http';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ cookies, locals }) => {
	destroySession(locals.sessionId);
	clearSessionCookie(cookies);
	return json({ ok: true });
};
