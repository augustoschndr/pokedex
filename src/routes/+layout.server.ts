import { pendingDecisionCount } from '$lib/server/content';
import type { LayoutServerLoad } from './$types';

const TABS = new Set(['/today', '/week', '/you', '/study', '/decisions']);

export const load: LayoutServerLoad = async ({ locals, url }) => {
	const path = url.pathname;
	return {
		user: locals.user,
		path,
		showTabs: Boolean(locals.user && TABS.has(path)),
		pendingDecisions: locals.user ? pendingDecisionCount(locals.user.id) : 0,
		vapidPublicKey: process.env.VAPID_PUBLIC_KEY ?? ''
	};
};
