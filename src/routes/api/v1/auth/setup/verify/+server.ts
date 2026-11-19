import { setSetupCookie, verifySetupCode } from '$lib/server/auth';
import { allow } from '$lib/server/db';
import { clientKey, json } from '$lib/server/http';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, cookies, getClientAddress }) => {
	let address = 'unknown';
	try {
		address = getClientAddress();
	} catch {
		address = 'unknown';
	}
	if (!allow(clientKey(address, 'auth'))) {
		return json({ ok: false, error: 'rate_limited' }, 429);
	}
	let body: { code?: string };
	try {
		body = (await request.json()) as { code?: string };
	} catch {
		return json({ ok: false, error: 'invalid_json' }, 400);
	}
	const result = verifySetupCode(String(body.code ?? ''));
	if (!result.ok) return json({ ok: false, error: 'invalid_code' }, 401);
	setSetupCookie(cookies, result.codeId);
	return json({ ok: true });
};
