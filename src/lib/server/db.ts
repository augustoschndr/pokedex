import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import {
	generateSetupCode,
	hashSecret,
	normalizeSetupCode,
	randomId,
	safeEqual,
	verifySecret
} from './crypto';
import { assertEnv, databasePath, displayName } from './env';
import { nowIso, nowMs } from './time';
import { ingestSchema, type IngestPayload } from './schema';
import sampleBrief from '../../../docs/example-payload.json';

let database: Database.Database | null = null;
let booted = false;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS user (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  data_deleted_at TEXT,
  onboarding_done INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS webauthn_credential (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES user(id),
  public_key BLOB NOT NULL,
  counter INTEGER NOT NULL,
  device_type TEXT,
  backed_up INTEGER,
  transports TEXT,
  created_at TEXT NOT NULL,
  last_used_at TEXT
);

CREATE TABLE IF NOT EXISTS auth_challenge (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  type TEXT NOT NULL,
  challenge TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  consumed_at TEXT
);

CREATE TABLE IF NOT EXISTS session (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES user(id),
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  user_agent TEXT
);

CREATE TABLE IF NOT EXISTS push_subscription (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES user(id),
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS api_token (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES user(id),
  name TEXT NOT NULL,
  token_prefix TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  scopes TEXT NOT NULL,
  created_at TEXT NOT NULL,
  revoked_at TEXT
);

CREATE TABLE IF NOT EXISTS setup_code (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES user(id),
  code_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS brief (
  user_id TEXT NOT NULL REFERENCES user(id),
  id TEXT NOT NULL,
  type TEXT NOT NULL,
  timezone TEXT NOT NULL,
  for_date TEXT,
  title TEXT,
  push_title TEXT,
  push_body TEXT,
  payload_json TEXT NOT NULL,
  received_at TEXT NOT NULL,
  pushed_at TEXT,
  PRIMARY KEY (user_id, id)
);

CREATE TABLE IF NOT EXISTS screen_meta (
  user_id TEXT NOT NULL REFERENCES user(id),
  key TEXT NOT NULL,
  value TEXT,
  brief_id TEXT,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (user_id, key)
);

CREATE TABLE IF NOT EXISTS today_item (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES user(id),
  brief_id TEXT,
  is_current INTEGER NOT NULL DEFAULT 1,
  date_label TEXT,
  for_date TEXT,
  lesson TEXT,
  where_it_goes TEXT,
  pillar TEXT,
  body TEXT,
  hook TEXT,
  talking_points_json TEXT,
  whiteboard_json TEXT,
  cta TEXT,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS week_item (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES user(id),
  ingest_id TEXT NOT NULL,
  brief_id TEXT,
  is_current INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL,
  lead TEXT,
  title TEXT NOT NULL,
  detail TEXT,
  meta TEXT,
  status_label TEXT,
  status_tone TEXT,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS todo (
  user_id TEXT NOT NULL REFERENCES user(id),
  id TEXT NOT NULL,
  brief_id TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  text TEXT NOT NULL,
  meta TEXT,
  done INTEGER NOT NULL DEFAULT 0,
  done_at TEXT,
  archived INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (user_id, id)
);

CREATE TABLE IF NOT EXISTS study_block (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES user(id),
  ingest_id TEXT NOT NULL,
  brief_id TEXT,
  grp TEXT NOT NULL,
  is_current INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL,
  heading TEXT,
  kind TEXT NOT NULL,
  body_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS decision (
  user_id TEXT NOT NULL REFERENCES user(id),
  id TEXT NOT NULL,
  brief_id TEXT,
  title TEXT NOT NULL,
  detail TEXT,
  status TEXT NOT NULL,
  answer_comment TEXT,
  answered_at TEXT,
  answered_epoch INTEGER,
  notified_back_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (user_id, id)
);

CREATE TABLE IF NOT EXISTS decision_event (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES user(id),
  decision_id TEXT NOT NULL,
  action TEXT NOT NULL,
  comment TEXT,
  at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS rate_limit (
  bucket TEXT PRIMARY KEY,
  window_start INTEGER NOT NULL,
  count INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_today_current ON today_item(user_id, is_current);
CREATE INDEX IF NOT EXISTS idx_week_current ON week_item(user_id, is_current, sort_order);
CREATE INDEX IF NOT EXISTS idx_study_current ON study_block(user_id, grp, is_current, sort_order);
CREATE INDEX IF NOT EXISTS idx_decision_answered ON decision(user_id, answered_epoch);
CREATE INDEX IF NOT EXISTS idx_todo_user ON todo(user_id, archived, sort_order);
`;

export function db(): Database.Database {
	if (!database) {
		const file = databasePath();
		fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
		database = new Database(file);
		database.pragma('journal_mode = WAL');
		database.pragma('foreign_keys = ON');
		database.pragma('busy_timeout = 5000');
		database.exec(SCHEMA);
	}
	return database;
}

export type Owner = {
	id: string;
	display_name: string;
	onboarding_done: number;
	created_at: string;
	data_deleted_at: string | null;
};

export function owner(): Owner {
	const row = db().prepare('SELECT * FROM user ORDER BY created_at ASC LIMIT 1').get() as Owner | undefined;
	if (!row) throw new Error('owner missing');
	return row;
}

function ensureOwner(): void {
	const existing = db().prepare('SELECT id FROM user LIMIT 1').get();
	if (existing) return;
	const ts = nowIso();
	db()
		.prepare(
			'INSERT INTO user (id, display_name, created_at, updated_at, onboarding_done) VALUES (?, ?, ?, ?, 0)'
		)
		.run(randomId(), displayName(), ts, ts);
}

function syncPrimaryToken(): void {
	const token = process.env.INGEST_TOKEN ?? '';
	const user = owner();
	const ts = nowIso();
	db().prepare(`DELETE FROM api_token WHERE name = 'primary' AND user_id = ?`).run(user.id);
	db()
		.prepare(
			`INSERT INTO api_token (id, user_id, name, token_prefix, token_hash, scopes, created_at)
       VALUES (?, ?, 'primary', ?, ?, 'ingest:write decisions:read', ?)`
		)
		.run(randomId(), user.id, token.slice(0, 8), hashSecret(token), ts);
}

export function boot(): void {
	if (booted) return;
	assertEnv();
	db();
	ensureOwner();
	syncPrimaryToken();
	ensureSetupCode();
	if (process.env.SEED_DEMO === '1') seedDemo();
	booted = true;
}

export function allow(bucket: string, limit = 10, windowMs = 10 * 60 * 1000): boolean {
	const now = nowMs();
	const row = db()
		.prepare('SELECT window_start, count FROM rate_limit WHERE bucket = ?')
		.get(bucket) as { window_start: number; count: number } | undefined;
	if (!row || now - row.window_start >= windowMs) {
		db()
			.prepare(
				`INSERT INTO rate_limit (bucket, window_start, count) VALUES (?, ?, 1)
         ON CONFLICT(bucket) DO UPDATE SET window_start = excluded.window_start, count = 1`
			)
			.run(bucket, now);
		return true;
	}
	if (row.count >= limit) return false;
	db().prepare('UPDATE rate_limit SET count = count + 1 WHERE bucket = ?').run(bucket);
	return true;
}

export type TokenPrincipal = { id: string; scopes: string[] };

export function principalForToken(token: string): TokenPrincipal | null {
	const envToken = process.env.INGEST_TOKEN ?? '';
	if (envToken && safeEqual(token, envToken)) {
		return { id: owner().id, scopes: ['ingest:write', 'decisions:read'] };
	}
	const prefix = token.slice(0, 8);
	const rows = db()
		.prepare(
			`SELECT user_id, token_hash, scopes FROM api_token
       WHERE token_prefix = ? AND revoked_at IS NULL AND name != 'primary'`
		)
		.all(prefix) as { user_id: string; token_hash: string; scopes: string }[];
	for (const row of rows) {
		if (verifySecret(token, row.token_hash)) {
			return { id: row.user_id, scopes: row.scopes.split(' ').filter(Boolean) };
		}
	}
	return null;
}

function seedDemo(): void {
	const user = owner();
	const count = db().prepare('SELECT COUNT(*) AS c FROM brief WHERE user_id = ?').get(user.id) as {
		c: number;
	};
	if (count.c > 0) return;
	const parsed = ingestSchema.safeParse(sampleBrief);
	if (!parsed.success) {
		console.error('SEED_DEMO payload failed validation');
		return;
	}
	applyIngest(user.id, parsed.data);
	console.log('SEED_DEMO applied sample brief');
}

export function setMeta(userId: string, key: string, value: string, briefId: string): void {
	db()
		.prepare(
			`INSERT INTO screen_meta (user_id, key, value, brief_id, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(user_id, key) DO UPDATE SET
         value = excluded.value,
         brief_id = excluded.brief_id,
         updated_at = excluded.updated_at`
		)
		.run(userId, key, value, briefId, nowIso());
}

export function getMeta(userId: string, key: string): string {
	const row = db()
		.prepare('SELECT value FROM screen_meta WHERE user_id = ? AND key = ?')
		.get(userId, key) as { value: string | null } | undefined;
	return row?.value ?? '';
}

export function applyIngest(userId: string, payload: IngestPayload): string {
	const now = nowIso();
	const run = db().transaction(() => {
		db()
			.prepare(
				`INSERT INTO brief (user_id, id, type, timezone, for_date, title, push_title, push_body, payload_json, received_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(user_id, id) DO UPDATE SET
           type = excluded.type,
           timezone = excluded.timezone,
           for_date = excluded.for_date,
           title = excluded.title,
           push_title = excluded.push_title,
           push_body = excluded.push_body,
           payload_json = excluded.payload_json,
           received_at = excluded.received_at`
			)
			.run(
				userId,
				payload.id,
				payload.type,
				payload.timezone,
				payload.for_date ?? null,
				payload.title ?? null,
				payload.push?.title ?? payload.title ?? 'Pokedex',
				payload.push?.body ?? 'A new brief is ready',
				JSON.stringify(payload),
				now
			);

		if (payload.today) {
			db().prepare('UPDATE today_item SET is_current = 0 WHERE user_id = ? AND is_current = 1').run(userId);
			const today = payload.today;
			db()
				.prepare(
					`INSERT INTO today_item (
            id, user_id, brief_id, is_current, date_label, for_date, lesson, where_it_goes, pillar,
            body, hook, talking_points_json, whiteboard_json, cta, updated_at
          ) VALUES (?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
				)
				.run(
					randomId(),
					userId,
					payload.id,
					today.date_label ?? null,
					today.for_date ?? payload.for_date ?? null,
					today.lesson ?? null,
					today.where_it_goes ?? null,
					today.pillar ?? null,
					today.body ?? null,
					today.hook ?? null,
					JSON.stringify(today.talking_points ?? []),
					today.whiteboard ? JSON.stringify(today.whiteboard) : null,
					today.cta ?? null,
					now
				);
		}

		if (payload.week) {
			setMeta(userId, 'week_intro', payload.week.intro ?? '', payload.id);
			db().prepare('UPDATE week_item SET is_current = 0 WHERE user_id = ? AND is_current = 1').run(userId);
			const insert = db().prepare(
				`INSERT INTO week_item (
          id, user_id, ingest_id, brief_id, is_current, sort_order, lead, title, detail, meta, status_label, status_tone, updated_at
        ) VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?)`
			);
			payload.week.items.forEach((item, index) => {
				insert.run(
					randomId(),
					userId,
					item.id,
					payload.id,
					index,
					item.lead ?? null,
					item.title,
					item.detail ?? null,
					item.meta ?? null,
					item.status?.label ?? null,
					item.status?.tone ?? 'default',
					now
				);
			});
		}

		if (payload.todos) {
			setMeta(userId, 'todos_intro', payload.todos.intro ?? '', payload.id);
			if (payload.todos.items.length === 0) {
				db()
					.prepare(
						`UPDATE todo SET archived = 1, brief_id = ?, updated_at = ? WHERE user_id = ? AND archived = 0`
					)
					.run(payload.id, now, userId);
			} else {
				const select = db().prepare('SELECT done, done_at FROM todo WHERE user_id = ? AND id = ?');
				const upsert = db().prepare(
					`INSERT INTO todo (user_id, id, brief_id, sort_order, text, meta, done, done_at, archived, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(user_id, id) DO UPDATE SET
             brief_id = excluded.brief_id,
             sort_order = excluded.sort_order,
             text = excluded.text,
             meta = excluded.meta,
             done = excluded.done,
             done_at = excluded.done_at,
             archived = excluded.archived,
             updated_at = excluded.updated_at`
				);
				payload.todos.items.forEach((item, index) => {
					const existing = select.get(userId, item.id) as
						| { done: number; done_at: string | null }
						| undefined;
					let done = existing?.done ?? (item.done ? 1 : 0);
					let doneAt = existing?.done_at ?? (item.done ? now : null);
					if (!existing && item.done) {
						done = 1;
						doneAt = now;
					}
					if (item.force_status && typeof item.done === 'boolean') {
						done = item.done ? 1 : 0;
						doneAt = item.done ? (existing?.done_at ?? now) : null;
					}
					const archived = item.archived === true ? 1 : 0;
					upsert.run(
						userId,
						item.id,
						payload.id,
						index,
						item.text,
						item.meta ?? null,
						done,
						doneAt,
						archived,
						now
					);
				});
			}
		}

		const replaceGroup = (group: 'study' | 'reels_rules', introKey: string) => {
			const section = group === 'study' ? payload.study : payload.reels_rules;
			if (!section) return;
			setMeta(userId, introKey, section.intro ?? '', payload.id);
			db()
				.prepare('UPDATE study_block SET is_current = 0 WHERE user_id = ? AND grp = ? AND is_current = 1')
				.run(userId, group);
			const insert = db().prepare(
				`INSERT INTO study_block (
          id, user_id, ingest_id, brief_id, grp, is_current, sort_order, heading, kind, body_json, updated_at
        ) VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?)`
			);
			section.blocks.forEach((block, index) => {
				const { id: blockId, heading, kind, ...rest } = block;
				insert.run(
					randomId(),
					userId,
					blockId,
					payload.id,
					group,
					index,
					heading ?? null,
					kind,
					JSON.stringify(rest),
					now
				);
			});
		};
		replaceGroup('study', 'study_intro');
		replaceGroup('reels_rules', 'reels_intro');

		if (payload.decisions) {
			const select = db().prepare('SELECT status FROM decision WHERE user_id = ? AND id = ?');
			const insert = db().prepare(
				`INSERT INTO decision (
          user_id, id, brief_id, title, detail, status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)`
			);
			const update = db().prepare(
				`UPDATE decision SET brief_id = ?, title = ?, detail = ?, updated_at = ?
         WHERE user_id = ? AND id = ? AND status = 'pending'`
			);
			for (const item of payload.decisions) {
				const existing = select.get(userId, item.id) as { status: string } | undefined;
				if (!existing) {
					insert.run(userId, item.id, payload.id, item.title, item.detail ?? null, now, now);
				} else if (existing.status === 'pending') {
					update.run(payload.id, item.title, item.detail ?? null, now, userId, item.id);
				}
			}
		}
	});
	run();
	return payload.id;
}

export function markPushed(userId: string, briefId: string): void {
	db()
		.prepare('UPDATE brief SET pushed_at = ? WHERE user_id = ? AND id = ?')
		.run(nowIso(), userId, briefId);
}

function ensureSetupCode(): void {
	const user = owner();
	const creds = db()
		.prepare('SELECT COUNT(*) AS c FROM webauthn_credential WHERE user_id = ?')
		.get(user.id) as { c: number };
	if (creds.c > 0) return;

	const envCode = process.env.SETUP_CODE?.trim();
	if (envCode) {
		const unused = db()
			.prepare(
				`SELECT code_hash FROM setup_code
         WHERE user_id = ? AND used_at IS NULL AND expires_at > ?`
			)
			.all(user.id, nowIso()) as { code_hash: string }[];
		const normalized = envCode.toUpperCase().replace(/[^A-Z0-9]/g, '');
		const matches = unused.some((row) => verifySecret(normalized, row.code_hash));
		if (!matches) {
			db()
				.prepare(
					`UPDATE setup_code SET used_at = ? WHERE user_id = ? AND used_at IS NULL`
				)
				.run(nowIso(), user.id);
			const expires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
			db()
				.prepare(
					`INSERT INTO setup_code (id, user_id, code_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?)`
				)
				.run(randomId(), user.id, hashSecret(normalized), expires, nowIso());
		}
		return;
	}

	const unused = db()
		.prepare(
			`SELECT id FROM setup_code WHERE user_id = ? AND used_at IS NULL AND expires_at > ? LIMIT 1`
		)
		.get(user.id, nowIso());
	if (unused) return;

	const code = generateSetupCode();
	const expires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
	db()
		.prepare(
			`INSERT INTO setup_code (id, user_id, code_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?)`
		)
		.run(randomId(), user.id, hashSecret(normalizeSetupCode(code)), expires, nowIso());
	fs.writeSync(1, `POKEDEX_SETUP_CODE=${code}\n`);
}

/** Break-glass and post-wipe enrollment. Prints the code once. Previous unused codes stop working. */
export function issueFreshSetupCode(userId: string): void {
	const now = nowIso();
	db().prepare('UPDATE setup_code SET used_at = ? WHERE user_id = ? AND used_at IS NULL').run(now, userId);
	const fromEnv = process.env.SETUP_CODE?.trim();
	const normalized = fromEnv ? normalizeSetupCode(fromEnv) : normalizeSetupCode(generateSetupCode());
	const shown = normalized.length === 8 ? `${normalized.slice(0, 4)}-${normalized.slice(4)}` : normalized;
	const expires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
	db()
		.prepare(
			`INSERT INTO setup_code (id, user_id, code_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?)`
		)
		.run(randomId(), userId, hashSecret(normalized), expires, now);
	fs.writeSync(1, `POKEDEX_SETUP_CODE=${shown}\n`);
}
