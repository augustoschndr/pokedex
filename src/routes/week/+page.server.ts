import { currentWeek } from '$lib/server/content';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals }) => {
	return locals.user ? currentWeek(locals.user.id) : { intro: '', items: [] };
};
