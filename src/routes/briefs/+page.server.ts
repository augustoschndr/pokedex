import { listBriefs } from '$lib/server/content';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals }) => {
	return { briefs: locals.user ? listBriefs(locals.user.id) : [] };
};
