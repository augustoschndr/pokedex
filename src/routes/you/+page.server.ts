import { currentTodos } from '$lib/server/content';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals }) => {
	return locals.user ? currentTodos(locals.user.id) : { intro: '', items: [] };
};
