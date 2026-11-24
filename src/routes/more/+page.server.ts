import { morePage } from '$lib/server/screens';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals }) => {
	if (!locals.user) return { openTodos: 0, studyCount: 0, briefCount: 0, pending: 0 };
	return morePage(locals.user.id);
};
