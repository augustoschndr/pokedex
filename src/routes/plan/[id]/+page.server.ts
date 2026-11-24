import { error } from '@sveltejs/kit';
import { planPage } from '$lib/server/screens';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals, params }) => {
	if (!locals.user) error(401, 'Unauthorized');
	const plan = planPage(locals.user.id);
	const phase = plan?.phases.find((item) => item.id === params.id) ?? null;
	if (!phase) error(404, 'Not found');
	return { phase };
};
