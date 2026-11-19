import { fail, redirect } from '@sveltejs/kit';
import { credentialCount, setSetupCookie, setupCookieValid, verifySetupCode } from '$lib/server/auth';
import { allow } from '$lib/server/db';
import { clientKey } from '$lib/server/http';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ cookies, url }) => {
	const ready = setupCookieValid(cookies);
	const step = url.searchParams.get('step');
	return {
		step: ready ? 'passkey' : step === 'code' ? 'code' : 'welcome',
		hasPasskey: credentialCount() > 0
	};
};

export const actions: Actions = {
	code: async ({ request, cookies, getClientAddress }) => {
		let address = 'unknown';
		try {
			address = getClientAddress();
		} catch {
			address = 'unknown';
		}
		if (!allow(clientKey(address, 'auth'))) {
			return fail(429, { error: 'Too many tries. Wait a few minutes' });
		}
		const form = await request.formData();
		const result = verifySetupCode(String(form.get('code') ?? ''));
		if (!result.ok) return fail(401, { error: 'That code is not valid' });
		setSetupCookie(cookies, result.codeId);
		throw redirect(303, '/setup?step=passkey');
	}
};
