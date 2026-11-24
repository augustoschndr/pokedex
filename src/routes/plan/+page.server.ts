import { planPage } from '$lib/server/screens';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals }) => {
	return { plan: locals.user ? planPage(locals.user.id) : null };
};
