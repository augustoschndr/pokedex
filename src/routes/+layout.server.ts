import { pendingDecisionCount } from '$lib/server/content';
import { secureCookie } from '$lib/server/env';
import { morePage, planPage, todayPage, weekPage } from '$lib/server/screens';
import { userTheme } from '$lib/server/theme';
import { THEME_COOKIE, themeForRequest } from '$lib/theme';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = ({ locals, cookies }) => {
	const user = locals.user;
	const theme = themeForRequest(user ? userTheme(user.id) : null, cookies.get(THEME_COOKIE));
	cookies.set(THEME_COOKIE, theme, {
		path: '/',
		httpOnly: false,
		sameSite: 'lax',
		secure: secureCookie(),
		maxAge: 60 * 60 * 24 * 365
	});
	return {
		user,
		theme,
		pendingDecisions: user ? pendingDecisionCount(user.id) : 0,
		vapidPublicKey: process.env.VAPID_PUBLIC_KEY ?? '',
				tabs: user
			? {
					today: { screen: todayPage(user.id) },
					week: weekPage(user.id),
					plan: { plan: planPage(user.id) },
					more: morePage(user.id)
				}
			: null
	};
};
