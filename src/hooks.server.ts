import { redirect, type Handle } from '@sveltejs/kit';
import { applyNoStore, isPublicIconPath, uncachedDocument } from '$lib/icons';
import { credentialCount, readSession } from '$lib/server/auth';
import { boot } from '$lib/server/db';
import { secureCookie } from '$lib/server/env';
import { shiftSchedule } from '$lib/server/schedule';
import { userTheme } from '$lib/server/theme';
import { THEME_COOKIE, parseTheme, startupMarkup, themeForRequest, themePaint } from '$lib/theme';

const PUBLIC_PAGES = new Set(['/login', '/setup', '/manifest.webmanifest', '/service-worker.js']);

function isPublic(path: string): boolean {
	return PUBLIC_PAGES.has(path) || isPublicIconPath(path);
}

export const handle: Handle = async ({ event, resolve }) => {
	try {
		boot();
	} catch (error) {
		console.error(error instanceof Error ? error.message : error);
		return new Response('Pokedex is not configured', { status: 500 });
	}

	const session = readSession(event.cookies);
	event.locals.user = session
		? {
				id: session.id,
				displayName: session.displayName,
				onboardingDone: session.onboardingDone
			}
		: null;
	event.locals.sessionId = session?.sessionId ?? null;

	const path = event.url.pathname;
	if (!path.startsWith('/api/') && !isPublicIconPath(path) && path !== '/service-worker.js') {
		const theme = themeForRequest(
			event.locals.user ? userTheme(event.locals.user.id) : null,
			event.cookies.get(THEME_COOKIE)
		);
		event.cookies.set(THEME_COOKIE, theme, {
			path: '/',
			httpOnly: false,
			sameSite: 'lax',
			secure: secureCookie(),
			maxAge: 60 * 60 * 24 * 365
		});
	}

	if (!path.startsWith('/api/')) {
		if (!event.locals.user) {
			if (!isPublic(path)) {
				throw redirect(303, credentialCount() > 0 ? '/login' : '/setup');
			}
		} else if (path === '/' || path === '/login' || path === '/setup') {
			throw redirect(303, event.locals.user.onboardingDone ? '/today' : '/onboarding');
		} else if (!event.locals.user.onboardingDone && path !== '/onboarding' && !isPublic(path)) {
			throw redirect(303, '/onboarding');
		} else if (event.locals.user.onboardingDone && path === '/onboarding') {
			throw redirect(303, '/today');
		}
	}

	if (event.locals.user?.onboardingDone) shiftSchedule(event.locals.user.id);

	const response = await resolve(event, {
		transformPageChunk: ({ html }) => {
			const paint = themePaint(parseTheme(event.cookies.get(THEME_COOKIE)));
			return html
				.replaceAll('%pokedex.theme-color%', paint.background)
				.replaceAll('%pokedex.ink%', paint.ink)
				.replaceAll('%pokedex.color-scheme%', paint.colorScheme)
				.replaceAll('%pokedex.resolved%', paint.resolved)
				.replaceAll('%pokedex.startup%', startupMarkup(parseTheme(event.cookies.get(THEME_COOKIE))));
		}
	});
	// HTML, the manifest, and the service worker must not sit on Cloudflare.
	// /_app/immutable/* is served before this hook and keeps its long cache.
	// A Cloudflare cache rule that ignores the origin Cache-Control can still override these headers.
	if (uncachedDocument(path, response.headers.get('content-type'))) applyNoStore(response.headers);
	response.headers.set('x-content-type-options', 'nosniff');
	// same-origin keeps the path off cross-site requests and still sends a real
	// Origin on same-site form posts. no-referrer forces Origin: null, which
	// SvelteKit rejects as a cross-site form submission.
	response.headers.set('referrer-policy', 'same-origin');
	response.headers.set('x-frame-options', 'DENY');
	// Same-origin camera and microphone so the teleprompter can preview and record.
	// The take never leaves the phone. Location stays blocked.
	response.headers.set('permissions-policy', 'camera=(self), microphone=(self), geolocation=()');
	return response;
};
