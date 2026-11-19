import { currentDecisions } from '$lib/server/content';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals }) => {
	return { decisions: locals.user ? currentDecisions(locals.user.id) : [] };
};
