import { credentialCount } from '$lib/server/auth';
import { json } from '$lib/server/http';
import { subscriptionCount } from '$lib/server/push';
import { userTheme } from '$lib/server/theme';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ locals }) => {
	if (!locals.user) return json({ ok: false, error: 'unauthorized' }, 401);
	return json({
		id: locals.user.id,
		display_name: locals.user.displayName,
		onboarding_done: locals.user.onboardingDone,
		theme: userTheme(locals.user.id),
		passkeys: credentialCount(locals.user.id),
		push_subscriptions: subscriptionCount(locals.user.id)
	});
};
