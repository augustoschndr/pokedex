import type { Cookies } from '@sveltejs/kit';
import {
	generateAuthenticationOptions,
	generateRegistrationOptions,
	verifyAuthenticationResponse,
	verifyRegistrationResponse
} from '@simplewebauthn/server';
import type {
	AuthenticationResponseJSON,
	PublicKeyCredentialCreationOptionsJSON,
	PublicKeyCredentialRequestOptionsJSON,
	RegistrationResponseJSON
} from '@simplewebauthn/server';
import { hashSecret, normalizeSetupCode, randomId, seal, unseal, verifySecret } from './crypto';
import { db, owner, type Owner } from './db';
import { origin, rpID, rpName, secureCookie, sessionCookieName, sessionSecret } from './env';
import { nowIso } from './time';

const SETUP_COOKIE = 'pokedex_setup';
const SESSION_MS = 30 * 24 * 60 * 60 * 1000;

type CredentialRow = {
	id: string;
	user_id: string;
	public_key: Buffer;
	counter: number;
	transports: string | null;
};

export type SessionUser = {
	id: string;
	displayName: string;
	onboardingDone: boolean;
	sessionId: string;
};

function cookieBase() {
	return {
		path: '/',
		httpOnly: true,
		secure: secureCookie(),
		sameSite: 'lax' as const
	};
}

export function credentialCount(userId = owner().id): number {
	const row = db()
		.prepare('SELECT COUNT(*) AS c FROM webauthn_credential WHERE user_id = ?')
		.get(userId) as { c: number };
	return row.c;
}

export function readSession(cookies: Cookies): SessionUser | null {
	const raw = cookies.get(sessionCookieName());
	if (!raw) return null;
	const id = unseal(raw, sessionSecret());
	if (!id) return null;
	const row = db()
		.prepare(
			`SELECT s.id, s.expires_at, s.last_seen_at, u.id AS user_id, u.display_name, u.onboarding_done
       FROM session s JOIN user u ON u.id = s.user_id WHERE s.id = ?`
		)
		.get(id) as
		| {
				id: string;
				expires_at: string;
				last_seen_at: string;
				user_id: string;
				display_name: string;
				onboarding_done: number;
		  }
		| undefined;
	if (!row) return null;
	if (Date.parse(row.expires_at) < Date.now()) {
		db().prepare('DELETE FROM session WHERE id = ?').run(id);
		return null;
	}
	const now = nowIso();
	if (Date.now() - Date.parse(row.last_seen_at) > 60_000) {
		const extend = Date.parse(row.expires_at) - Date.now() < 15 * 24 * 60 * 60 * 1000;
		if (extend) {
			const expires = new Date(Date.now() + SESSION_MS).toISOString();
			db().prepare('UPDATE session SET last_seen_at = ?, expires_at = ? WHERE id = ?').run(now, expires, id);
		} else {
			db().prepare('UPDATE session SET last_seen_at = ? WHERE id = ?').run(now, id);
		}
	}
	return {
		id: row.user_id,
		displayName: row.display_name,
		onboardingDone: row.onboarding_done === 1,
		sessionId: row.id
	};
}

export function setSessionCookie(cookies: Cookies, sessionId: string): void {
	cookies.set(sessionCookieName(), seal(sessionId, sessionSecret()), {
		...cookieBase(),
		maxAge: SESSION_MS / 1000
	});
}

export function clearSessionCookie(cookies: Cookies): void {
	cookies.delete(sessionCookieName(), { path: '/', secure: secureCookie() });
}

export function clearSetupCookie(cookies: Cookies): void {
	cookies.delete(SETUP_COOKIE, { path: '/', secure: secureCookie() });
}

function createSession(userId: string, userAgent: string | null): string {
	const id = randomId();
	const now = nowIso();
	const expires = new Date(Date.now() + SESSION_MS).toISOString();
	db()
		.prepare(
			`INSERT INTO session (id, user_id, created_at, expires_at, last_seen_at, user_agent)
       VALUES (?, ?, ?, ?, ?, ?)`
		)
		.run(id, userId, now, expires, now, userAgent);
	return id;
}

export function destroySession(sessionId: string | null): void {
	if (!sessionId) return;
	db().prepare('DELETE FROM session WHERE id = ?').run(sessionId);
}

type CodeRow = { id: string; code_hash: string };

export function verifySetupCode(raw: string): { ok: true; codeId: string } | { ok: false } {
	const user = owner();
	const normalized = normalizeSetupCode(raw);
	const rows = db()
		.prepare(
			`SELECT id, code_hash FROM setup_code
       WHERE user_id = ? AND used_at IS NULL AND expires_at > ?`
		)
		.all(user.id, nowIso()) as CodeRow[];
	if (!normalized || rows.length === 0) {
		verifySecret(normalized || 'invalid', dummyHash());
		return { ok: false };
	}
	for (const row of rows) {
		if (verifySecret(normalized, row.code_hash)) return { ok: true, codeId: row.id };
	}
	return { ok: false };
}

let dummy: string | null = null;
function dummyHash(): string {
	if (!dummy) dummy = hashSecret('pokedex-dummy-setup-code');
	return dummy;
}

export function setSetupCookie(cookies: Cookies, codeId: string): void {
	cookies.set(SETUP_COOKIE, seal(codeId, sessionSecret()), {
		...cookieBase(),
		maxAge: 10 * 60
	});
}

export function setupCookieValid(cookies: Cookies): boolean {
	const raw = cookies.get(SETUP_COOKIE);
	if (!raw) return false;
	const id = unseal(raw, sessionSecret());
	if (!id) return false;
	const row = db()
		.prepare(
			`SELECT id FROM setup_code WHERE id = ? AND used_at IS NULL AND expires_at > ?`
		)
		.get(id, nowIso());
	return Boolean(row);
}

function consumeSetupCodes(userId: string): void {
	db().prepare(`UPDATE setup_code SET used_at = ? WHERE user_id = ? AND used_at IS NULL`).run(nowIso(), userId);
}

function saveChallenge(userId: string, type: string, challenge: string): void {
	const expires = new Date(Date.now() + 5 * 60 * 1000).toISOString();
	db()
		.prepare(
			`INSERT INTO auth_challenge (id, user_id, type, challenge, expires_at) VALUES (?, ?, ?, ?, ?)`
		)
		.run(randomId(), userId, type, challenge, expires);
	db().prepare(`DELETE FROM auth_challenge WHERE expires_at < ?`).run(nowIso());
}

function takeChallenge(userId: string, type: string, challenge: string): boolean {
	const row = db()
		.prepare(
			`SELECT id FROM auth_challenge
       WHERE user_id = ? AND type = ? AND challenge = ? AND consumed_at IS NULL AND expires_at > ?
       LIMIT 1`
		)
		.get(userId, type, challenge, nowIso()) as { id: string } | undefined;
	if (!row) return false;
	db().prepare('UPDATE auth_challenge SET consumed_at = ? WHERE id = ?').run(nowIso(), row.id);
	return true;
}

export async function registrationOptions(): Promise<PublicKeyCredentialCreationOptionsJSON> {
	const user = owner();
	const existing = db()
		.prepare('SELECT id, transports FROM webauthn_credential WHERE user_id = ?')
		.all(user.id) as { id: string; transports: string | null }[];
	const options = await generateRegistrationOptions({
		rpName: rpName(),
		rpID: rpID(),
		userName: user.display_name,
		userID: new TextEncoder().encode(user.id),
		userDisplayName: user.display_name,
		attestationType: 'none',
		authenticatorSelection: {
			residentKey: 'required',
			userVerification: 'required'
		},
		preferredAuthenticatorType: 'localDevice',
		supportedAlgorithmIDs: [-7, -257],
		excludeCredentials: existing.map((row) => ({
			id: row.id,
			transports: row.transports ? (JSON.parse(row.transports) as string[]) : undefined
		}))
	});
	saveChallenge(user.id, 'registration', options.challenge);
	return options;
}

export async function verifyRegistration(
	response: RegistrationResponseJSON,
	userAgent: string | null
): Promise<{ ok: true; sessionId: string } | { ok: false }> {
	const user = owner();
	let verification;
	try {
		verification = await verifyRegistrationResponse({
			response,
			expectedChallenge: (challenge) => takeChallenge(user.id, 'registration', challenge),
			expectedOrigin: origin(),
			expectedRPID: rpID(),
			requireUserVerification: true,
			supportedAlgorithmIDs: [-7, -257]
		});
	} catch (error) {
		console.error('passkey registration failed', error instanceof Error ? error.message : 'error');
		return { ok: false };
	}
	if (!verification.verified) return { ok: false };
	const cred = verification.registrationInfo.credential;
	db()
		.prepare(
			`INSERT INTO webauthn_credential (
        id, user_id, public_key, counter, device_type, backed_up, transports, created_at, last_used_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
		)
		.run(
			cred.id,
			user.id,
			Buffer.from(cred.publicKey),
			cred.counter,
			verification.registrationInfo.credentialDeviceType,
			verification.registrationInfo.credentialBackedUp ? 1 : 0,
			JSON.stringify(cred.transports ?? []),
			nowIso(),
			nowIso()
		);
	consumeSetupCodes(user.id);
	const sessionId = createSession(user.id, userAgent);
	return { ok: true, sessionId };
}

export async function authenticationOptions(): Promise<PublicKeyCredentialRequestOptionsJSON> {
	const user = owner();
	const options = await generateAuthenticationOptions({
		rpID: rpID(),
		userVerification: 'required'
	});
	saveChallenge(user.id, 'authentication', options.challenge);
	return options;
}

export async function verifyAuthentication(
	response: AuthenticationResponseJSON,
	userAgent: string | null
): Promise<{ ok: true; sessionId: string } | { ok: false }> {
	const user = owner();
	const cred = db()
		.prepare('SELECT * FROM webauthn_credential WHERE id = ? AND user_id = ?')
		.get(response.id, user.id) as CredentialRow | undefined;
	if (!cred) return { ok: false };
	let verification;
	try {
		verification = await verifyAuthenticationResponse({
			response,
			expectedChallenge: (challenge) => takeChallenge(user.id, 'authentication', challenge),
			expectedOrigin: origin(),
			expectedRPID: rpID(),
			requireUserVerification: true,
			credential: {
				id: cred.id,
				publicKey: new Uint8Array(cred.public_key),
				counter: cred.counter,
				transports: cred.transports ? (JSON.parse(cred.transports) as string[]) : undefined
			}
		});
	} catch (error) {
		console.error('passkey sign-in failed', error instanceof Error ? error.message : 'error');
		return { ok: false };
	}
	if (!verification.verified) return { ok: false };
	db()
		.prepare('UPDATE webauthn_credential SET counter = ?, last_used_at = ? WHERE id = ?')
		.run(verification.authenticationInfo.newCounter, nowIso(), cred.id);
	return { ok: true, sessionId: createSession(user.id, userAgent) };
}

export function markOnboardingDone(userId: string): void {
	db().prepare('UPDATE user SET onboarding_done = 1, updated_at = ? WHERE id = ?').run(nowIso(), userId);
}

export function userRow(userId: string): Owner {
	return db().prepare('SELECT * FROM user WHERE id = ?').get(userId) as Owner;
}
