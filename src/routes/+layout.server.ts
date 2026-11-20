import { pendingDecisionCount } from '$lib/server/content';
import { secureCookie } from '$lib/server/env';
import { userTheme } from '$lib/server/theme';
import { THEME_COOKIE, type ThemeChoice } from '$lib/theme';
import type { LayoutServerLoad } from './$types';

const TABS = new Set(['/today', '/week', '/you', '/study', '/decisions']);

export const load: LayoutServerLoad = async ({ locals, url, cookies }) => {
	const path = url.pathname;
	const theme: ThemeChoice = locals.user ? userTheme(locals.user.id) : 'system';
	cookies.set(THEME_COOKIE, theme, {
		path: '/',
		httpOnly: false,
		sameSite: 'lax',
		secure: secureCookie(),
		maxAge: 60 * 60 * 24 * 365
	});
	return {
		user: locals.user,
		path,
		theme,
		showTabs: Boolean(locals.user && TABS.has(path)),
		pendingDecisions: locals.user ? pendingDecisionCount(locals.user.id) : 0,
		vapidPublicKey: process.env.VAPID_PUBLIC_KEY ?? ''
	};
};
