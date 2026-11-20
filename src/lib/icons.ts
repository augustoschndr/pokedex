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

/** The manifest URL is stable, so the document itself must revalidate. */
export const MANIFEST_CACHE = 'public, max-age=0, must-revalidate';

export const MANIFEST_CDN_CACHE = 'public, max-age=60';

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
