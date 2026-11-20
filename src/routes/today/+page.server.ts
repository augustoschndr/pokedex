import { todayPage } from '$lib/server/screens';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals }) => {
	if (!locals.user) return { screen: null };
	return { screen: todayPage(locals.user.id) };
};
