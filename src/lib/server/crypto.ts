import crypto from 'node:crypto';

const SCRYPT = { N: 16384, r: 8, p: 1 } as const;

export function hashSecret(secret: string): string {
	const salt = crypto.randomBytes(16);
	const hash = crypto.scryptSync(secret, salt, 32, SCRYPT);
	return `scrypt:${salt.toString('hex')}:${hash.toString('hex')}`;
}

export function verifySecret(secret: string, stored: string): boolean {
	const [kind, saltHex, hashHex] = stored.split(':');
	if (kind !== 'scrypt' || !saltHex || !hashHex) return false;
	const actual = crypto.scryptSync(secret, Buffer.from(saltHex, 'hex'), 32, SCRYPT);
	const expected = Buffer.from(hashHex, 'hex');
	if (actual.length !== expected.length) return false;
	return crypto.timingSafeEqual(actual, expected);
}

export function safeEqual(a: string, b: string): boolean {
	const ba = Buffer.from(a);
	const bb = Buffer.from(b);
	const len = Math.max(ba.length, bb.length, 1);
	const pa = Buffer.alloc(len);
	const pb = Buffer.alloc(len);
	ba.copy(pa);
	bb.copy(pb);
	return crypto.timingSafeEqual(pa, pb) && ba.length === bb.length;
}

export function randomId(): string {
	return crypto.randomUUID();
}

export function seal(value: string, secret: string): string {
	const sig = crypto.createHmac('sha256', secret).update(value).digest('base64url');
	return `${value}.${sig}`;
}

export function unseal(token: string, secret: string): string | null {
	const i = token.lastIndexOf('.');
	if (i <= 0) return null;
	const value = token.slice(0, i);
	const sig = token.slice(i + 1);
	const expected = crypto.createHmac('sha256', secret).update(value).digest('base64url');
	if (!safeEqual(sig, expected)) return null;
	return value;
}

export function signBody(body: string, secret: string): string {
	return crypto.createHmac('sha256', secret).update(body).digest('hex');
}

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateSetupCode(): string {
	const bytes = crypto.randomBytes(8);
	let raw = '';
	for (let i = 0; i < 8; i++) raw += ALPHABET[bytes[i]! % ALPHABET.length];
	return `${raw.slice(0, 4)}-${raw.slice(4)}`;
}

export function normalizeSetupCode(input: string): string {
	return input.toUpperCase().replace(/[^A-Z0-9]/g, '');
}
