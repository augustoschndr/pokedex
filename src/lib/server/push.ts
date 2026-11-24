import { sendNotification, setVapidDetails, WebPushError } from 'web-push';
import { randomId } from './crypto';
import { db } from './db';
import { outcomeFromStatus, validVapidSubject } from './push-status';
import { nowIso } from './time';
import type { IngestPayload } from './schema';

export function pushTarget(payload: IngestPayload): { title: string; body: string; url: string } {
	let url = '/today';
	if (payload.decisions && payload.decisions.length > 0) url = '/today';
	else if (payload.today) url = '/today';
	else if (payload.week) url = '/week';
	else if (payload.todos) url = '/you';
	else if (payload.study || payload.reels_rules) url = '/study';
	return {
		title: payload.push?.title ?? payload.title ?? 'Pokedex',
		body: payload.push?.body ?? 'A new brief is ready',
		url
	};
}

export type PushResult = { id: string; status: number; reason?: string };

export type PushReport = { sent: number; results: PushResult[]; error?: 'not_configured' | 'invalid_vapid_subject' };

function pushReason(body: string): string | undefined {
	try {
		const parsed = JSON.parse(body) as { reason?: unknown };
		if (typeof parsed.reason === 'string' && /^[A-Za-z0-9._-]{1,80}$/.test(parsed.reason)) return parsed.reason;
	} catch {
		/* the body is not a short reason */
	}
	return undefined;
}

function logPush(status: number, reason?: string): void {
	const line = reason ? `push status=${status} reason=${reason}` : `push status=${status}`;
	if (status >= 200 && status < 300) console.log(line);
	else console.error(line);
}

export async function pushToUser(
	userId: string,
	payload: { title: string; body: string; url: string }
): Promise<PushReport> {
	const publicKey = process.env.VAPID_PUBLIC_KEY;
	const privateKey = process.env.VAPID_PRIVATE_KEY;
	if (!publicKey || !privateKey) return { sent: 0, results: [], error: 'not_configured' };
	const subject = (process.env.VAPID_SUBJECT || 'mailto:augusto@folderr.co').trim();
	if (!validVapidSubject(subject)) {
		logPush(0, 'invalid_subject');
		return { sent: 0, results: [], error: 'invalid_vapid_subject' };
	}
	setVapidDetails(subject, publicKey, privateKey);
	const rows = db()
		.prepare('SELECT id, endpoint, p256dh, auth FROM push_subscription WHERE user_id = ?')
		.all(userId) as { id: string; endpoint: string; p256dh: string; auth: string }[];
	const body = JSON.stringify(payload);
	const results: PushResult[] = [];
	let sent = 0;
	for (const row of rows) {
		let status = 0;
		let reason: string | undefined;
		try {
			const response = await sendNotification(
				{ endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } },
				body,
				{ TTL: 86400, urgency: 'high' }
			);
			status = response.statusCode;
		} catch (error) {
			if (error instanceof WebPushError) {
				status = error.statusCode;
				reason = pushReason(error.body);
			}
		}
		const outcome = outcomeFromStatus(status);
		logPush(status, reason);
		if (outcome.drop) db().prepare('DELETE FROM push_subscription WHERE id = ?').run(row.id);
		if (outcome.ok) sent += 1;
		results.push(reason ? { id: row.id, status, reason } : { id: row.id, status });
	}
	return { sent, results };
}

export function saveSubscription(
	userId: string,
	endpoint: string,
	p256dh: string,
	auth: string,
	userAgent: string | null
): void {
	const now = nowIso();
	db()
		.prepare(
			`INSERT INTO push_subscription (id, user_id, endpoint, p256dh, auth, user_agent, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(endpoint) DO UPDATE SET
         user_id = excluded.user_id,
         p256dh = excluded.p256dh,
         auth = excluded.auth,
         user_agent = excluded.user_agent,
         updated_at = excluded.updated_at`
		)
		.run(randomId(), userId, endpoint, p256dh, auth, userAgent, now, now);
}

export function removeSubscription(userId: string, endpoint: string): void {
	db().prepare('DELETE FROM push_subscription WHERE user_id = ? AND endpoint = ?').run(userId, endpoint);
}

export function subscriptionCount(userId: string): number {
	const row = db()
		.prepare('SELECT COUNT(*) AS c FROM push_subscription WHERE user_id = ?')
		.get(userId) as { c: number };
	return row.c;
}
