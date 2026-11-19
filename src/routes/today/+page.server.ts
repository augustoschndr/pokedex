import { currentToday } from '$lib/server/content';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals }) => {
	return { today: locals.user ? currentToday(locals.user.id) : null };
};
