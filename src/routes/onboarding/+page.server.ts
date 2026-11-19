import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ url }) => {
	return { step: url.searchParams.get('step') === 'home' ? 'home' : 'notes' };
};
