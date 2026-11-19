import { markOnboardingDone } from '$lib/server/auth';
import { json } from '$lib/server/http';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = ({ locals }) => {
	if (!locals.user) return json({ ok: false, error: 'unauthorized' }, 401);
	markOnboardingDone(locals.user.id);
	return json({ ok: true });
};
