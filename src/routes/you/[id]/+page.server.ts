import { error } from '@sveltejs/kit';
import { getTask } from '$lib/server/content';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals, params }) => {
	if (!locals.user) error(401, 'Unauthorized');
	const task = getTask(locals.user.id, 'todo', params.id);
	if (!task) error(404, 'Not found');
	return { task };
};
