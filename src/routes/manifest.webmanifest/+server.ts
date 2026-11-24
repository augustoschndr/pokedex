import { applyNoStore, versionedIcon } from '$lib/icons';
import { manifestColors, parseTheme } from '$lib/theme';
import type { RequestHandler } from './$types';

const icons = [
	{ src: versionedIcon('icon-192.png'), sizes: '192x192', type: 'image/png', purpose: 'any' },
	{ src: versionedIcon('icon-512.png'), sizes: '512x512', type: 'image/png', purpose: 'any' },
	{ src: versionedIcon('icon-maskable-192.png'), sizes: '192x192', type: 'image/png', purpose: 'maskable' },
	{ src: versionedIcon('icon-maskable-512.png'), sizes: '512x512', type: 'image/png', purpose: 'maskable' }
];

export const GET: RequestHandler = ({ cookies }) => {
	const colors = manifestColors(parseTheme(cookies.get('pokedex-theme')));
	const manifest = {
		id: '/',
		name: 'Pokedex',
		short_name: 'Pokedex',
		description: 'Lesson, shot list, and decisions for the day',
		start_url: '/',
		scope: '/',
		display: 'standalone',
		background_color: colors.background_color,
		theme_color: colors.theme_color,
		lang: 'en',
		icons
	};
	const headers = new Headers({
		'content-type': 'application/manifest+json; charset=utf-8',
		vary: 'Cookie'
	});
	applyNoStore(headers);
	return new Response(JSON.stringify(manifest), { headers });
};
