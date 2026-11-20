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
		{ src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
		{ src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
		{ src: '/icons/icon-maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
		{ src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
	]
};

export const GET: RequestHandler = () =>
	new Response(JSON.stringify(manifest), {
		headers: {
			'content-type': 'application/manifest+json; charset=utf-8',
			'cache-control': 'public, max-age=86400'
		}
	});
