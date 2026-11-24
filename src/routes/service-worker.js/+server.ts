import worker from '$lib/pwa/service-worker.js?raw';
import { applyNoStore } from '$lib/icons';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = () => {
	const headers = new Headers({
		'content-type': 'application/javascript; charset=utf-8'
	});
	applyNoStore(headers);
	return new Response(worker, { headers });
};
