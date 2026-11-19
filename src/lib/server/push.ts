import { sendNotification, setVapidDetails } from 'web-push';
import { randomId } from './crypto';
import { db } from './db';
import { nowIso } from './time';
import type { IngestPayload } from './schema';

export function pushTarget(payload: IngestPayload): { title: string; body: string; url: string } {
	let url = '/today';
	if (payload.decisions && payload.decisions.length > 0) url = '/decisions';
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

export async function pushToUser(
	userId: string,
	payload: { title: string; body: string; url: string }
): Promise<number> {
	const publicKey = process.env.VAPID_PUBLIC_KEY;
	const privateKey = process.env.VAPID_PRIVATE_KEY;
	const subject = process.env.VAPID_SUBJECT || 'mailto:augusto@folderr.co';
	if (!publicKey || !privateKey) return 0;
	setVapidDetails(subject, publicKey, privateKey);
	const rows = db()
		.prepare('SELECT id, endpoint, p256dh, auth FROM push_subscription WHERE user_id = ?')
		.all(userId) as { id: string; endpoint: string; p256dh: string; auth: string }[];
	let sent = 0;
	const body = JSON.stringify(payload);
	for (const row of rows) {
		try {
			await sendNotification(
				{ endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } },
				body,
				{ TTL: 86400 }
			);
			sent += 1;
		} catch (error) {
			const status = (error as { statusCode?: number }).statusCode;
			if (status === 404 || status === 410) {
				db().prepare('DELETE FROM push_subscription WHERE id = ?').run(row.id);
			} else {
				console.error('push failed', status ?? 'error');
			}
		}
	}
	return sent;
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
