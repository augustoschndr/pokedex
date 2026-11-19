import { startAuthentication, startRegistration } from '@simplewebauthn/browser';

async function readError(response: Response, fallback: string): Promise<string> {
	try {
		const body = (await response.json()) as { error?: string };
		if (body.error === 'setup_required') return 'Enter the setup code first';
		if (body.error === 'rate_limited') return 'Too many tries. Wait a few minutes';
	} catch {
		/* ignore */
	}
	return fallback;
}

export async function createPasskey(): Promise<string> {
	const optionsRes = await fetch('/api/v1/auth/register/options', { method: 'POST' });
	if (!optionsRes.ok) throw new Error(await readError(optionsRes, 'Could not start the passkey'));
	const optionsBody = (await optionsRes.json()) as { options: Parameters<typeof startRegistration>[0]['optionsJSON'] };
	const credential = await startRegistration({ optionsJSON: optionsBody.options });
	const verifyRes = await fetch('/api/v1/auth/register/verify', {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(credential)
	});
	if (!verifyRes.ok) throw new Error(await readError(verifyRes, 'Passkey was not created. Try again'));
	const verified = (await verifyRes.json()) as { redirect?: string };
	return verified.redirect ?? '/onboarding';
}

export async function signIn(): Promise<string> {
	const optionsRes = await fetch('/api/v1/auth/login/options', { method: 'POST' });
	if (!optionsRes.ok) throw new Error(await readError(optionsRes, 'Could not start sign-in'));
	const optionsBody = (await optionsRes.json()) as {
		options: Parameters<typeof startAuthentication>[0]['optionsJSON'];
	};
	const credential = await startAuthentication({ optionsJSON: optionsBody.options });
	const verifyRes = await fetch('/api/v1/auth/login/verify', {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(credential)
	});
	if (!verifyRes.ok) throw new Error(await readError(verifyRes, 'Passkey was not accepted'));
	const verified = (await verifyRes.json()) as { redirect?: string };
	return verified.redirect ?? '/today';
}
