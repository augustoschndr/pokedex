import { secureCookie } from '$lib/server/env';
import { json } from '$lib/server/http';
import { setUserTheme } from '$lib/server/theme';
import { parseTheme, type ThemeChoice } from '$lib/theme';
import type { RequestHandler } from './$types';

function isTheme(value: unknown): value is ThemeChoice {
	return value === 'light' || value === 'dark' || value === 'system';
}

export const POST: RequestHandler = async ({ locals, request, cookies }) => {
	if (!locals.user) return json({ ok: false, error: 'unauthorized' }, 401);
	let body: { theme?: unknown } | null = null;
	try {
		body = (await request.json()) as { theme?: unknown };
	} catch {
		body = null;
	}
	if (!body || typeof body !== 'object' || !isTheme(body.theme)) {
		return json({ ok: false, error: 'theme must be light, dark, or system' }, 400);
	}
	const theme = parseTheme(body.theme);
	setUserTheme(locals.user.id, theme);
	cookies.set('pokedex-theme', theme, {
		path: '/',
		httpOnly: false,
		sameSite: 'lax',
		secure: secureCookie(),
		maxAge: 60 * 60 * 24 * 365
	});
	return json({ ok: true, theme });
};
