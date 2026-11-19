import { exportAll } from '$lib/server/content';
import { json } from '$lib/server/http';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ locals }) => {
	if (!locals.user) return json({ ok: false, error: 'unauthorized' }, 401);
	const day = new Date().toISOString().slice(0, 10);
	const body = exportAll(locals.user.id);
	return json(body, 200, {
		'content-disposition': `attachment; filename="pokedex-export-${day}.json"`
	});
};
