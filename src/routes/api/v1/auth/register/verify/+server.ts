import {
	clearSessionCookie,
	clearSetupCookie,
	setSessionCookie,
	setupCookieValid,
	verifyRegistration
} from '$lib/server/auth';
import { allow } from '$lib/server/db';
import { clientKey, json } from '$lib/server/http';
import type { RegistrationResponseJSON } from '@simplewebauthn/server';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, cookies, getClientAddress }) => {
	let address = 'unknown';
	try {
		address = getClientAddress();
	} catch {
		address = 'unknown';
	}
	if (!allow(clientKey(address, 'auth'))) return json({ ok: false, error: 'rate_limited' }, 429);
	if (!setupCookieValid(cookies)) return json({ ok: false, error: 'setup_required' }, 401);
	let body: RegistrationResponseJSON;
	try {
		body = (await request.json()) as RegistrationResponseJSON;
	} catch {
		return json({ ok: false, error: 'invalid_json' }, 400);
	}
	const result = await verifyRegistration(body, request.headers.get('user-agent'));
	if (!result.ok) return json({ ok: false, error: 'passkey_failed' }, 400);
	clearSetupCookie(cookies);
	clearSessionCookie(cookies);
	setSessionCookie(cookies, result.sessionId);
	return json({ ok: true, redirect: '/onboarding' });
};
