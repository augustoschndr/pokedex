import { error } from '@sveltejs/kit';
import { getBrief } from '$lib/server/content';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals, params }) => {
	if (!locals.user) error(401, 'Unauthorized');
	const brief = getBrief(locals.user.id, params.id);
	if (!brief) error(404, 'Not found');
	return { brief };
};
