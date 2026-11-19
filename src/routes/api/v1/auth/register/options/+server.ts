import { registrationOptions, setupCookieValid } from '$lib/server/auth';
import { allow } from '$lib/server/db';
import { clientKey, json } from '$lib/server/http';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ cookies, getClientAddress }) => {
	let address = 'unknown';
	try {
		address = getClientAddress();
	} catch {
		address = 'unknown';
	}
	if (!allow(clientKey(address, 'auth'))) return json({ ok: false, error: 'rate_limited' }, 429);
	if (!setupCookieValid(cookies)) return json({ ok: false, error: 'setup_required' }, 401);
	const options = await registrationOptions();
	return json({ ok: true, options });
};
