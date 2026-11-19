import { setSessionCookie, verifyAuthentication } from '$lib/server/auth';
import { allow, owner } from '$lib/server/db';
import { clientKey, json } from '$lib/server/http';
import type { AuthenticationResponseJSON } from '@simplewebauthn/server';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, cookies, getClientAddress }) => {
	let address = 'unknown';
	try {
		address = getClientAddress();
	} catch {
		address = 'unknown';
	}
	if (!allow(clientKey(address, 'auth'))) return json({ ok: false, error: 'rate_limited' }, 429);
	let body: AuthenticationResponseJSON;
	try {
		body = (await request.json()) as AuthenticationResponseJSON;
	} catch {
		return json({ ok: false, error: 'invalid_json' }, 400);
	}
	const result = await verifyAuthentication(body, request.headers.get('user-agent'));
	if (!result.ok) return json({ ok: false, error: 'passkey_failed' }, 401);
	setSessionCookie(cookies, result.sessionId);
	const user = owner();
	return json({ ok: true, redirect: user.onboarding_done ? '/today' : '/onboarding' });
};
