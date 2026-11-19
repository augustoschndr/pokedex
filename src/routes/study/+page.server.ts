import { currentStudy } from '$lib/server/content';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals }) => {
	return locals.user
		? currentStudy(locals.user.id)
		: { study: { intro: '', blocks: [] }, reels_rules: { intro: '', blocks: [] } };
};
