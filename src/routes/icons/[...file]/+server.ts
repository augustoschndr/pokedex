import { error } from '@sveltejs/kit';
import { versionedIconResponse } from '$lib/server/icon-assets';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ params }) => {
	const response = versionedIconResponse(params.file);
	if (!response) error(404, 'Not found');
	return response;
};
