import { credentialCount } from '$lib/server/auth';
import { subscriptionCount } from '$lib/server/push';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals }) => {
	if (!locals.user) return { passkeys: 0, push: 0, name: '' };
	return {
		name: locals.user.displayName,
		passkeys: credentialCount(locals.user.id),
		push: subscriptionCount(locals.user.id)
	};
};
