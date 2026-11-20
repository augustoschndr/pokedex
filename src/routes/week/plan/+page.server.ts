import { error } from '@sveltejs/kit';
import { currentPlan } from '$lib/server/content';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals }) => {
	if (!locals.user) error(401, 'Unauthorized');
	return { plan: currentPlan(locals.user.id) };
};
