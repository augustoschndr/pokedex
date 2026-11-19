const REQUIRED_IN_PRODUCTION = [
	'ORIGIN',
	'DATABASE_PATH',
	'INGEST_TOKEN',
	'VAPID_PUBLIC_KEY',
	'VAPID_PRIVATE_KEY',
	'VAPID_SUBJECT',
	'WEBAUTHN_RP_ID',
	'SESSION_SECRET'
] as const;

export function assertEnv(): void {
	if (process.env.NODE_ENV !== 'production') {
		if (!process.env.SESSION_SECRET) {
			throw new Error('SESSION_SECRET is required. Copy .env.example to .env.');
		}
		if (!process.env.INGEST_TOKEN) {
			throw new Error('INGEST_TOKEN is required. Copy .env.example to .env.');
		}
		return;
	}
	const missing = REQUIRED_IN_PRODUCTION.filter((key) => !process.env[key]?.trim());
	if (missing.length) {
		throw new Error(`Missing env: ${missing.join(', ')}`);
	}
	if ((process.env.INGEST_TOKEN ?? '').length < 16) {
		throw new Error('INGEST_TOKEN must be at least 16 characters');
	}
	if ((process.env.SESSION_SECRET ?? '').length < 16) {
		throw new Error('SESSION_SECRET must be at least 16 characters');
	}
}

export function origin(): string {
	return (process.env.ORIGIN ?? 'http://localhost:3000').replace(/\/$/, '');
}

export function databasePath(): string {
	return process.env.DATABASE_PATH ?? './data/pokedex.db';
}

export function sessionSecret(): string {
	const value = process.env.SESSION_SECRET;
	if (!value) throw new Error('SESSION_SECRET is required');
	return value;
}

export function rpID(): string {
	if (process.env.WEBAUTHN_RP_ID?.trim()) return process.env.WEBAUTHN_RP_ID.trim();
	return new URL(origin()).hostname;
}

export function rpName(): string {
	return process.env.WEBAUTHN_RP_NAME?.trim() || 'Pokedex';
}

export function displayName(): string {
	return process.env.USER_DISPLAY_NAME?.trim() || 'Augusto';
}

export function timeZone(): string {
	return process.env.TZ?.trim() || 'America/Sao_Paulo';
}

export function secureCookie(): boolean {
	return origin().startsWith('https://');
}

export function sessionCookieName(): string {
	return secureCookie() ? '__Host-pokedex' : 'pokedex_session';
}

export function webhookUrl(): string | null {
	const url = process.env.DECISIONS_WEBHOOK_URL || process.env.DECISION_WEBHOOK_URL;
	return url?.trim() || null;
}

export function webhookSecret(): string | null {
	return process.env.DECISIONS_WEBHOOK_SECRET?.trim() || process.env.INGEST_TOKEN || null;
}
