import { MANIFEST_CACHE, MANIFEST_CDN_CACHE, versionedIcon } from '$lib/icons';
import type { RequestHandler } from './$types';

const manifest = {
	id: '/',
	name: 'Pokedex',
	short_name: 'Pokedex',
	description: 'Lesson, shot list, and decisions for the day',
	start_url: '/',
	scope: '/',
	display: 'standalone',
	background_color: '#FBF7F3',
	theme_color: '#FBF7F3',
	lang: 'en',
	icons: [
		{ src: versionedIcon('icon-192.png'), sizes: '192x192', type: 'image/png', purpose: 'any' },
		{ src: versionedIcon('icon-512.png'), sizes: '512x512', type: 'image/png', purpose: 'any' },
		{ src: versionedIcon('icon-maskable-192.png'), sizes: '192x192', type: 'image/png', purpose: 'maskable' },
		{ src: versionedIcon('icon-maskable-512.png'), sizes: '512x512', type: 'image/png', purpose: 'maskable' }
	]
};

export const GET: RequestHandler = () =>
	new Response(JSON.stringify(manifest), {
		headers: {
			'content-type': 'application/manifest+json; charset=utf-8',
			'cache-control': MANIFEST_CACHE,
			'cdn-cache-control': MANIFEST_CDN_CACHE
		}
	});
