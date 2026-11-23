import { read } from '$app/server';
import apple from '$lib/brand/icons/apple-touch-icon.png';
import appleDark from '$lib/brand/icons/apple-touch-icon-dark.png';
import favicon from '$lib/brand/icons/favicon-32.png';
import faviconDark from '$lib/brand/icons/favicon-32-dark.png';
import icon192 from '$lib/brand/icons/icon-192.png';
import icon512 from '$lib/brand/icons/icon-512.png';
import maskable192 from '$lib/brand/icons/icon-maskable-192.png';
import maskable512 from '$lib/brand/icons/icon-maskable-512.png';
import iconSvg from '$lib/brand/icons/icon.svg';
import iconSvgDark from '$lib/brand/icons/icon-dark.svg';
import { versionedIcon, VERSIONED_CACHE } from '$lib/icons';

const startupFiles = import.meta.glob('$lib/brand/startup/*.png', {
	eager: true,
	import: 'default'
}) as Record<string, string>;

type IconAsset = { asset: string; type: string };

function entry(file: string, asset: string, type: string): [string, IconAsset] {
	return [versionedIcon(file).slice('/icons/'.length), { asset, type }];
}

export const appleTouchAsset = apple;

export const versionedIcons: Record<string, IconAsset> = Object.fromEntries([
	entry('apple-touch-icon.png', apple, 'image/png'),
	entry('apple-touch-icon-dark.png', appleDark, 'image/png'),
	entry('favicon-32.png', favicon, 'image/png'),
	entry('favicon-32-dark.png', faviconDark, 'image/png'),
	entry('icon-192.png', icon192, 'image/png'),
	entry('icon-512.png', icon512, 'image/png'),
	entry('icon-maskable-192.png', maskable192, 'image/png'),
	entry('icon-maskable-512.png', maskable512, 'image/png'),
	entry('icon.svg', iconSvg, 'image/svg+xml'),
	entry('icon-dark.svg', iconSvgDark, 'image/svg+xml'),
	...Object.entries(startupFiles).map(([filePath, asset]) => {
		const file = filePath.split('/').pop() ?? '';
		return entry(file, asset, 'image/png');
	})
]);

export function iconResponse(asset: string, cache: string, type?: string): Response {
	const file = read(asset);
	const headers = new Headers(file.headers);
	if (type) headers.set('content-type', type);
	headers.set('cache-control', cache);
	headers.set('cdn-cache-control', cache);
	return new Response(file.body, { status: 200, headers });
}

export function versionedIconResponse(name: string): Response | null {
	const icon = versionedIcons[name];
	if (!icon) return null;
	return iconResponse(icon.asset, VERSIONED_CACHE, icon.type);
}
