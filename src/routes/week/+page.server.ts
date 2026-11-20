import { weekPage } from '$lib/server/screens';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals }) => {
	if (!locals.user) {
		return { today: '', dateLabel: '', intro: '', days: [], undated: [] };
	}
	return weekPage(locals.user.id);
};
