/**
 * Public icon URLs include this revision.
 * Bump it whenever the artwork changes. The new URL is a cache miss
 * for Safari, the service worker, and Cloudflare.
 */
export const ICON_REV = 'v4';

/** Hashed build assets can sit forever. These URLs change with ICON_REV. */
export const VERSIONED_CACHE = 'public, max-age=31536000, immutable';

/**
 * iOS probes these exact paths. Keep the edge copy short so a later
 * artwork change is not stuck behind Cloudflare's default four hours.
 */
export const ROOT_TOUCH_CACHE = 'public, max-age=300, must-revalidate';

/**
 * Stable URLs: HTML, the manifest, and the service worker.
 * Without this, Cloudflare keeps a copy for four hours.
 * A Cache Rule that ignores origin cache headers can still override it.
 */
export const NO_STORE = 'no-cache, no-store, must-revalidate';

export const MANIFEST_CACHE = NO_STORE;

export const MANIFEST_CDN_CACHE = 'no-store';

export function uncachedDocument(pathname: string, contentType: string | null): boolean {
	if (pathname.startsWith('/_app/immutable/')) return false;
	if (pathname === '/service-worker.js' || pathname === '/manifest.webmanifest') return true;
	return (contentType ?? '').toLowerCase().startsWith('text/html');
}

export function applyNoStore(headers: Headers): void {
	headers.set('cache-control', NO_STORE);
	headers.set('cdn-cache-control', MANIFEST_CDN_CACHE);
	headers.set('cloudflare-cdn-cache-control', MANIFEST_CDN_CACHE);
}

export const ROOT_TOUCH_PATHS = ['/apple-touch-icon.png', '/apple-touch-icon-precomposed.png'] as const;

export function versionedIcon(file: string): string {
	const dot = file.lastIndexOf('.');
	if (dot <= 0) throw new Error(`icon file needs an extension: ${file}`);
	return `/icons/${file.slice(0, dot)}-${ICON_REV}${file.slice(dot)}`;
}

export const appleTouchHref = versionedIcon('apple-touch-icon.png');
export const faviconHref = versionedIcon('favicon-32.png');
export const faviconDarkHref = versionedIcon('favicon-32-dark.png');
export const iconSvgHref = versionedIcon('icon.svg');
export const iconSvgDarkHref = versionedIcon('icon-dark.svg');
export const manifestHref = `/manifest.webmanifest?v=${ICON_REV}`;

export function isPublicIconPath(pathname: string): boolean {
	return pathname.startsWith('/icons/') || (ROOT_TOUCH_PATHS as readonly string[]).includes(pathname);
}
