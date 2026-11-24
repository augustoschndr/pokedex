/**
 * Proves ingest -> screens -> decision answer -> answers endpoint.
 * Builds must already exist (`npm run build`).
 */
import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import Database from 'better-sqlite3';
import { generateVAPIDKeys } from 'web-push';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const port = 3456;
const origin = `http://127.0.0.1:${port}`;
const token = crypto.randomBytes(24).toString('hex');
const sessionSecret = crypto.randomBytes(24).toString('hex');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pokedex-flow-'));
const dbPath = path.join(dir, 'pokedex.db');
const vapid = generateVAPIDKeys();
const sample = JSON.parse(fs.readFileSync(path.join(root, 'docs/example-payload.json'), 'utf8'));

const failures = [];
function check(cond, message) {
	if (!cond) {
		failures.push(message);
		console.error('FAIL', message);
	}
}

function addIso(iso, days) {
	const [y, m, d] = iso.split('-').map(Number);
	const date = new Date(Date.UTC(y, m - 1, d + days));
	const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
	const dd = String(date.getUTCDate()).padStart(2, '0');
	return `${date.getUTCFullYear()}-${mm}-${dd}`;
}

function seal(id) {
	const sig = crypto.createHmac('sha256', sessionSecret).update(id).digest('base64url');
	return `${id}.${sig}`;
}

async function api(pathname, { method = 'GET', body, bearer, cookie } = {}) {
	const headers = {};
	if (body !== undefined) headers['content-type'] = 'application/json';
	if (bearer) headers.authorization = `Bearer ${bearer}`;
	if (cookie) headers.cookie = cookie;
	const response = await fetch(origin + pathname, {
		method,
		headers,
		body: body === undefined ? undefined : JSON.stringify(body)
	});
	const text = await response.text();
	let json = null;
	try {
		json = JSON.parse(text);
	} catch {
		json = text;
	}
	return { status: response.status, json, text };
}

const hooks = [];
const webhook = http.createServer((req, res) => {
	const chunks = [];
	req.on('data', (chunk) => chunks.push(chunk));
	req.on('end', () => {
		const body = Buffer.concat(chunks).toString('utf8');
		hooks.push({ body, sig: req.headers['x-pokedex-signature'] });
		res.writeHead(204);
		res.end();
	});
});
await new Promise((resolve) => webhook.listen(0, '127.0.0.1', resolve));
const hookPort = webhook.address().port;

const child = spawn('node', ['build'], {
	cwd: root,
	env: {
		...process.env,
		NODE_ENV: 'production',
		PORT: String(port),
		HOST: '127.0.0.1',
		ORIGIN: origin,
		DATABASE_PATH: dbPath,
		INGEST_TOKEN: token,
		SESSION_SECRET: sessionSecret,
		VAPID_PUBLIC_KEY: vapid.publicKey,
		VAPID_PRIVATE_KEY: vapid.privateKey,
		VAPID_SUBJECT: 'mailto:augusto@folderr.co',
		WEBAUTHN_RP_ID: '127.0.0.1',
		WEBAUTHN_RP_NAME: 'Pokedex',
		TZ: 'America/Sao_Paulo',
		DECISIONS_WEBHOOK_URL: `http://127.0.0.1:${hookPort}/hook`,
		SEED_DEMO: '0'
	},
	stdio: ['ignore', 'pipe', 'pipe']
});
let logs = '';
child.stdout.on('data', (buf) => {
	logs += buf.toString();
});
child.stderr.on('data', (buf) => {
	logs += buf.toString();
});

async function waitHealth() {
	for (let i = 0; i < 50; i++) {
		try {
			const res = await fetch(`${origin}/api/health`);
			if (res.ok) return;
		} catch {
			/* starting */
		}
		await new Promise((r) => setTimeout(r, 100));
	}
	throw new Error('server did not become healthy\n' + logs);
}

try {
	if (!fs.existsSync(path.join(root, 'build/index.js'))) {
		throw new Error('Missing build/. Run npm run build first.');
	}
	await waitHealth();
	check(/POKEDEX_SETUP_CODE=[A-Z0-9]{4}-[A-Z0-9]{4}/.test(logs), 'setup code printed once');
	const setupCode = logs.match(/POKEDEX_SETUP_CODE=([A-Z0-9]{4}-[A-Z0-9]{4})/)?.[1];

	const health = await api('/api/v1/health');
	check(health.status === 200 && health.json.ok === true, 'health');

	async function raw(pathname) {
		const response = await fetch(origin + pathname, { redirect: 'manual' });
		const buf = Buffer.from(await response.arrayBuffer());
		return { status: response.status, headers: response.headers, buf };
	}
	function pngSize(buf) {
		return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
	}
	const touch = await raw('/apple-touch-icon.png');
	const precomposed = await raw('/apple-touch-icon-precomposed.png');
	const versionedTouch = await raw('/icons/apple-touch-icon-v4.png');
	const oldTouch = await raw('/icons/apple-touch-icon.png');
	const pngSig = '89504e470d0a1a0a';
	check(touch.status === 200 && touch.headers.get('content-type')?.startsWith('image/png'), 'root touch icon is a png');
	check(touch.headers.get('location') == null, 'root touch icon is not a redirect');
	check(touch.buf.subarray(0, 8).toString('hex') === pngSig, 'root touch icon png signature');
	check(pngSize(touch.buf).width === 180 && pngSize(touch.buf).height === 180, 'root touch icon is 180');
	check(touch.headers.get('cache-control') === 'public, max-age=300, must-revalidate', 'root touch icon cache');
	check(precomposed.status === 200 && precomposed.buf.equals(touch.buf), 'precomposed touch icon matches');
	check(
		precomposed.headers.get('cache-control') === 'public, max-age=300, must-revalidate',
		'precomposed touch icon cache'
	);
	check(versionedTouch.status === 200 && versionedTouch.buf.equals(touch.buf), 'versioned touch icon matches');
	check(
		versionedTouch.headers.get('cache-control') === 'public, max-age=31536000, immutable',
		'versioned touch icon cache'
	);
	check(oldTouch.status === 404, 'old touch icon path is gone');
	check(!String(oldTouch.headers.get('location') || '').includes('login'), 'old touch icon does not redirect to login');
	const manifestRes = await raw('/manifest.webmanifest');
	check(manifestRes.status === 200, 'manifest is public');
	check(manifestRes.headers.get('cache-control') === 'no-cache, no-store, must-revalidate', 'manifest is not cached');
	check(manifestRes.headers.get('cdn-cache-control') === 'no-store', 'manifest cdn cache');
	check(manifestRes.headers.get('cloudflare-cdn-cache-control') === 'no-store', 'manifest cloudflare cache');
	const manifest = JSON.parse(manifestRes.buf.toString('utf8'));
	check(manifest.background_color === '#FBF7F3' && manifest.theme_color === '#FBF7F3', 'manifest background defaults to light');
	check(
		manifest.icons.every((icon) => icon.src.includes('-v4.')),
		'manifest icons are versioned'
	);
	check(!manifest.icons.some((icon) => icon.src === '/icons/icon-192.png'), 'manifest dropped the old icon url');
	const login = await raw('/login');
	const loginHtml = login.buf.toString('utf8');
	check(login.status === 200, 'login page');
	check(login.headers.get('cache-control') === 'no-cache, no-store, must-revalidate', 'html is not cached');
	check(login.headers.get('cdn-cache-control') === 'no-store', 'html cdn cache');
	check(login.headers.get('cloudflare-cdn-cache-control') === 'no-store', 'html cloudflare cache');
	const sw = await raw('/service-worker.js');
	check(sw.status === 200 && sw.buf.toString('utf8').includes("const CACHE = 'pokedex-v13'"), 'service worker is served');
	check(sw.headers.get('cache-control') === 'no-cache, no-store, must-revalidate', 'service worker is not cached');
	check(sw.headers.get('cdn-cache-control') === 'no-store', 'service worker cdn cache');
	check(sw.headers.get('cloudflare-cdn-cache-control') === 'no-store', 'service worker cloudflare cache');
	const immutableFile = (() => {
		const base = path.join(root, 'build/client/_app/immutable');
		const stack = [base];
		while (stack.length) {
			const dir = stack.pop();
			for (const name of fs.readdirSync(dir)) {
				const full = path.join(dir, name);
				if (fs.statSync(full).isDirectory()) stack.push(full);
				else if (!name.endsWith('.map')) return full;
			}
		}
		return null;
	})();
	check(immutableFile != null, 'build has an immutable asset');
	if (immutableFile) {
		const rel =
			'/' + path.relative(path.join(root, 'build/client'), immutableFile).split(path.sep).join('/');
		const hashed = await raw(rel);
		check(
			hashed.status === 200 && hashed.headers.get('cache-control') === 'public,max-age=31536000,immutable',
			`immutable asset stays cached (${hashed.headers.get('cache-control')})`
		);
	}
	check(loginHtml.includes('href="/icons/apple-touch-icon-v4.png"'), 'login head links the versioned touch icon');
	check(loginHtml.includes('sizes="180x180"'), 'touch icon declares 180');
	check(loginHtml.includes('href="/manifest.webmanifest?v=v4"'), 'manifest link is versioned');
	check(!loginHtml.includes('href="/icons/apple-touch-icon.png"'), 'login head dropped the old touch icon');
	check(!loginHtml.includes('apple-touch-startup-image'), 'a system theme has no launch image');
	const lightLogin = await fetch(origin + '/login', {
		headers: { cookie: 'pokedex-theme=light' },
		redirect: 'manual'
	});
	const lightHtml = await lightLogin.text();
	const startup = lightHtml.match(/<link rel="apple-touch-startup-image"[^>]*>/g) || [];
	check(lightLogin.status === 200 && startup.length === 1, 'light theme emits one startup image');
	check(startup[0]?.includes('/icons/startup-750x1334-v4.png') === true, 'light startup image');
	check(!startup[0]?.includes('prefers-color-scheme'), 'startup image ignores system dark mode');
	check(lightHtml.includes('content="#FBF7F3"'), 'light theme-color');
	const darkLogin = await fetch(origin + '/login', {
		headers: { cookie: 'pokedex-theme=dark' },
		redirect: 'manual'
	});
	const darkHtml = await darkLogin.text();
	check(darkHtml.includes('/icons/startup-750x1334-dark-v4.png'), 'dark startup image');
	check(darkHtml.includes('content="#1C1916"'), 'dark theme-color');
	const darkManifestRes = await fetch(origin + '/manifest.webmanifest', {
		headers: { cookie: 'pokedex-theme=dark' }
	});
	const darkManifest = await darkManifestRes.json();
	check(
		darkManifest.background_color === '#1C1916' && darkManifest.theme_color === '#1C1916',
		'manifest colors follow the cookie'
	);
	check((darkManifestRes.headers.get('vary') || '').toLowerCase().includes('cookie'), 'manifest varies on the cookie');
	const icon192 = await raw('/icons/icon-192-v4.png');
	check(icon192.status === 200 && pngSize(icon192.buf).width === 192, 'manifest 192 icon');
	const startupPng = await raw('/icons/startup-750x1334-v4.png');
	check(
		startupPng.status === 200 && pngSize(startupPng.buf).width === 750 && pngSize(startupPng.buf).height === 1334,
		'SE launch image'
	);

	const denied = await api('/api/v1/ingest', { method: 'POST', bearer: 'nope', body: {} });
	check(denied.status === 401, 'bad token is 401');

	const invalid = await api('/api/v1/ingest', {
		method: 'POST',
		bearer: token,
		body: { id: 'x', type: 'nope' }
	});
	check(invalid.status === 400 && invalid.json.error === 'invalid_payload', 'invalid payload is 400');

	const created = await api('/api/v1/ingest', { method: 'POST', bearer: token, body: sample });
	check(created.status === 200 && created.json.brief_id === sample.id && created.json.pushed === 0, 'ingest ok');

	const pushDenied = await api('/api/v1/push/test', { method: 'POST' });
	check(pushDenied.status === 401, 'push test without a token is 401');
	const pushTest = await api('/api/v1/push/test', { method: 'POST', bearer: token });
	check(
		pushTest.status === 200 && pushTest.json.pushed === 0 && Array.isArray(pushTest.json.results) && pushTest.json.results.length === 0,
		'push test with no devices'
	);
	check(!pushTest.text.includes('p256dh') && !pushTest.text.includes(vapid.privateKey), 'push test leaks no keys');

	const alias = await api('/api/ingest', {
		method: 'POST',
		bearer: token,
		body: { ...sample, id: 'brief-alias', title: 'alias' }
	});
	check(alias.status === 200, 'unversioned ingest alias');

	const db = new Database(dbPath);
	const user = db.prepare('SELECT id FROM user LIMIT 1').get();
	const sessionId = crypto.randomUUID();
	const now = new Date().toISOString();
	const exp = new Date(Date.now() + 30 * 864e5).toISOString();
	db.prepare(
		'INSERT INTO session (id, user_id, created_at, expires_at, last_seen_at, user_agent) VALUES (?, ?, ?, ?, ?, ?)'
	).run(sessionId, user.id, now, exp, now, 'flow-test');
	db.prepare('UPDATE user SET onboarding_done = 1 WHERE id = ?').run(user.id);
	db.close();
	const cookie = `pokedex_session=${seal(sessionId)}`;

	const pushSession = await api('/api/v1/push/test', { method: 'POST', cookie });
	check(pushSession.status === 200 && pushSession.json.pushed === 0, 'signed-in push test');

	const today = await api('/api/v1/today', { cookie });
	check(today.json.today?.lesson?.includes('Origin-story'), 'today screen');
	const zoneToday = new Intl.DateTimeFormat('en-CA', {
		timeZone: 'America/Sao_Paulo',
		year: 'numeric',
		month: '2-digit',
		day: '2-digit'
	}).format(new Date());
	const todayLabel = new Intl.DateTimeFormat('en-US', {
		timeZone: 'America/Sao_Paulo',
		weekday: 'long',
		month: 'short',
		day: 'numeric'
	}).format(new Date());
	const todayPage = await api('/today', { cookie });
	check(todayPage.status === 200, 'today page');
	check(todayPage.text.includes(todayLabel), `today page shows ${todayLabel}`);
	check(todayPage.text.includes('Decide US website pricing'), 'a pending decision is on today');
	check(todayPage.text.includes('>Approve<'), 'the decision offers a choice');
	if (zoneToday < '2026-11-23') {
		check(todayPage.text.includes('Prep day'), 'prep day before the brief');
		check(todayPage.text.includes('— in ') || todayPage.text.includes('tomorrow'), 'prep countdown');
		check(!todayPage.text.includes('Monday, Nov 23, 2026'), 'brief date is not presented as today');
	} else if (zoneToday === '2026-11-23') {
		check(todayPage.text.includes('Origin-story'), 'lesson shows on its own day');
	}
	const weekPage = await api('/week', { cookie });
	check(weekPage.status === 200 && weekPage.text.includes('>Week<'), 'week page');
	check(!weekPage.text.includes('Nothing scheduled'), 'week is a list, not an empty calendar');
	const theme = await api('/api/v1/me/theme', { method: 'POST', cookie, body: { theme: 'dark' } });
	check(theme.status === 200 && theme.json.theme === 'dark', 'theme saved');
	const me = await api('/api/v1/me', { cookie });
	check(me.json.theme === 'dark', 'theme on profile');
	const badTheme = await api('/api/v1/me/theme', { method: 'POST', cookie, body: { theme: 'blue' } });
	check(badTheme.status === 400, 'bad theme rejected');
	await api('/api/v1/me/theme', { method: 'POST', cookie, body: { theme: 'system' } });
	const week = await api('/api/v1/week', { cookie });
	check(week.json.items?.length === 5, 'week screen has 5 shots');
	{
		const weekStart = (() => {
			const [y, m, d] = zoneToday.split('-').map(Number);
			const index = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
			const delta = index === 0 ? -6 : 1 - index;
			return addIso(zoneToday, delta);
		})();
		const weekEnd = addIso(weekStart, 6);
		const inWeek = week.json.items.filter((item) => item.date >= weekStart && item.date <= weekEnd);
		if (inWeek.length === 0) {
			check(weekPage.text.includes('Nothing this week'), 'empty week says so');
		} else {
			check(weekPage.text.includes(`${inWeek.filter((item) => item.done).length} of ${inWeek.length}`), 'week progress');
			for (const item of inWeek) check(weekPage.text.includes(item.title), `week lists ${item.title}`);
		}
	}
	const todos = await api('/api/v1/todos', { cookie });
	check(todos.json.items?.some((item) => item.id === 'cf-cal' && item.done === false), 'todo open');
	const study = await api('/api/v1/study', { cookie });
	check(study.json.study.blocks.length === 4, 'study blocks');
	check(study.json.reels_rules.blocks.length === 2, 'reels rules on study');
	const decisions = await api('/api/v1/decisions', { cookie });
	check(decisions.json.decisions?.[0]?.status === 'pending', 'decision pending');

	const toggled = await api('/api/v1/todos/cf-cal/toggle', { method: 'POST', cookie });
	check(toggled.status === 200 && toggled.json.item.done === true, 'toggle todo');

	const answered = await api('/api/v1/decisions/dec-us-pricing-2026-11/answer', {
		method: 'POST',
		cookie,
		body: {
			action: 'approved',
			comment: 'Keep US$5k–10k and sell Portal as founding-client early access.'
		}
	});
	check(answered.status === 200 && answered.json.answer.action === 'approved', 'decision answer');
	check(/-03:00$/.test(answered.json.answer.answered_at), 'answer timestamp in Sao Paulo');

	const needsComment = await api('/api/v1/decisions/dec-us-pricing-2026-11/answer', {
		method: 'POST',
		cookie,
		body: { action: 'commented', comment: '   ' }
	});
	check(needsComment.status === 400, 'empty comment rejected');

	for (let i = 0; i < 30 && hooks.length === 0; i++) {
		await new Promise((r) => setTimeout(r, 100));
	}
	check(hooks.length === 1, 'webhook delivered');
	if (hooks[0]) {
		const mac = crypto.createHmac('sha256', token).update(hooks[0].body).digest('hex');
		check(hooks[0].sig === `sha256=${mac}`, 'webhook HMAC');
		const payload = JSON.parse(hooks[0].body);
		check(payload.action === 'approved' && payload.id === 'dec-us-pricing-2026-11', 'webhook body');
	}

	const answers = await api('/api/v1/decisions/answers?since=2020-01-01T00:00:00Z', { bearer: token });
	check(answers.status === 200 && answers.json.answers.length === 1, 'answers endpoint');
	check(answers.json.answers[0].comment.includes('founding-client'), 'answer comment returned');
	check(answers.json.answers[0].option === 'Approve', 'answer exposes the chosen option');
	const future = await api('/api/v1/decisions/answers?since=2999-01-01T00:00:00Z', { bearer: token });
	check(future.json.answers.length === 0, 'since filter');
	const aliasAnswers = await api('/api/decisions/answers', { bearer: token });
	check(aliasAnswers.status === 200 && aliasAnswers.json.answers.length === 1, 'answers alias');

	const second = await api('/api/v1/ingest', {
		method: 'POST',
		bearer: token,
		body: {
			id: sample.id,
			type: 'daily',
			for_date: '2026-11-23',
			today: { lesson: 'Updated lesson title' },
			todos: { items: [{ id: 'cf-cal', text: 'Updated cloudflare task', done: false }] },
			decisions: [{ id: 'dec-us-pricing-2026-11', title: 'This title must not stick', detail: 'nope' }]
		}
	});
	check(second.status === 200, 'second ingest');
	const today2 = await api('/api/v1/today', { cookie });
	check(today2.json.today.lesson === 'Updated lesson title', 'today replaced');
	const todos2 = await api('/api/v1/todos', { cookie });
	const cloud = todos2.json.items.find((item) => item.id === 'cf-cal');
	check(cloud?.done === true && cloud.text === 'Updated cloudflare task', 'tick survives ingest');

	const readback = await api('/api/v1/todos', { bearer: token });
	check(readback.status === 200 && Array.isArray(readback.json.items), 'todo readback');
	const cfTick = readback.json.items.find((item) => item.kind === 'todo' && item.id === 'cf-cal');
	check(cfTick?.done === true && typeof cfTick.done_at === 'string' && cfTick.done_at.includes('T'), 'readback has the todo tick');
	const record = readback.json.items.find((item) => item.kind === 'checklist' && item.id === 'record');
	check(record?.parent_id === 'cf-cal' && record.parent_kind === 'todo' && record.done === false && record.done_at === null, 'checklist readback');
	const shotTick = readback.json.items.find((item) => item.kind === 'week' && item.id === '2026-11-23-origin');
	check(shotTick?.done === false && shotTick.parent_id === null, 'week shot readback');
	const sessionList = await api('/api/v1/todos', { cookie });
	check(sessionList.json.items?.some((item) => item.id === 'cf-cal' && item.text), 'session todo list stays the phone shape');
	const badSince = await api('/api/v1/todos?since=not-a-date', { bearer: token });
	check(badSince.status === 400 && badSince.json.error === 'invalid_since', 'bad since');

	const sinceMark = new Date().toISOString();
	const flipped = await api('/api/v1/checklist/toggle', {
		method: 'POST',
		cookie,
		body: { parent_kind: 'todo', parent_id: 'cf-cal', id: 'record' }
	});
	check(flipped.status === 200 && flipped.json.item.done === true && typeof flipped.json.item.done_at === 'string', 'checklist tick');
	const since = await api(`/api/v1/todos?since=${encodeURIComponent(sinceMark)}`, { bearer: token });
	check(since.json.items.some((item) => item.id === 'record' && item.done === true), 'since returns the checklist change');
	check(!since.json.items.some((item) => item.id === 'esim'), 'since skips an untouched todo');

	const keepGuide = await api('/api/v1/ingest', {
		method: 'POST',
		bearer: token,
		body: {
			id: 'brief-guide-keep',
			type: 'ad_hoc',
			todos: {
				items: [
					{
						id: 'cf-cal',
						text: 'Updated cloudflare task',
						guide: {
							summary: 'Point cal.folderr.co at the server, then stop. The first Cal.com visit is a separate task.',
							checklist: [
								{ id: 'record', text: 'A record saved, DNS only' },
								{ id: 'resolve', text: 'cal.folderr.co answers that address' }
							]
						}
					}
				]
			}
		}
	});
	check(keepGuide.status === 200, 'guide reingest');
	const keptTicks = await api('/api/v1/todos', { bearer: token });
	check(
		keptTicks.json.items.find((item) => item.id === 'record' && item.kind === 'checklist')?.done === true,
		'checklist tick survives reingest'
	);
	const stillDone = keptTicks.json.items.find((item) => item.id === 'cf-cal' && item.kind === 'todo');
	check(stillDone?.done === true, 'todo tick survives a guide reingest');

	const weekToggled = await api('/api/v1/week/2026-11-23-origin/toggle', { method: 'POST', cookie });
	check(weekToggled.status === 200 && weekToggled.json.item.done === true, 'week tick');
	const weekKept = await api('/api/v1/ingest', {
		method: 'POST',
		bearer: token,
		body: {
			id: 'brief-week-keep',
			type: 'weekly',
			week: { items: [{ id: '2026-11-23-origin', title: 'Film the origin-story long-form' }] }
		}
	});
	check(weekKept.status === 200, 'week reingest');
	const weekTicks = await api('/api/v1/todos', { bearer: token });
	const originTick = weekTicks.json.items.find((item) => item.kind === 'week' && item.id === '2026-11-23-origin');
	check(originTick?.done === true && typeof originTick.done_at === 'string', 'week tick survives reingest');
	const film = await api('/week/2026-11-23-origin', { cookie });
	check(film.status === 200 && film.text.includes('Read the script'), 'week detail keeps the script');
	const planPage = await api('/week/plan', { cookie });
	check(planPage.status === 200 && planPage.text.includes('Logbook launch'), 'plan page');
	const todoDetail = await api('/you/cf-cal', { cookie });
	check(todoDetail.status === 200 && todoDetail.text.includes('Point cal.folderr.co'), 'todo detail');
	const decisions2 = await api('/api/v1/decisions', { cookie });
	check(
		decisions2.json.decisions[0].title === 'Decide US website pricing',
		'answered decision is not rewritten'
	);

	const weekOnly = await api('/api/v1/ingest', {
		method: 'POST',
		bearer: token,
		body: {
			id: 'brief-week',
			type: 'weekly',
			week: { intro: 'Friday plan', items: [{ id: 'one', lead: 'Fri', title: 'Only shot' }] }
		}
	});
	check(weekOnly.status === 200, 'weekly kind');
	const week2 = await api('/api/v1/week', { cookie });
	check(week2.json.items.length === 1 && week2.json.intro === 'Friday plan', 'week replaced');

	const lostA = addIso(zoneToday, -2);
	const lostB = addIso(zoneToday, -1);
	const later = addIso(zoneToday, 1);
	const idA = `${addIso(zoneToday, 10)}-a`;
	const idB = `${addIso(zoneToday, 11)}-b`;
	const idC = `${addIso(zoneToday, 12)}-c`;
	const idTask = `${addIso(zoneToday, 10)}-task`;
	const doneAt = '2001-02-02T00:00:00.000Z';
	const holdAt = '2001-03-03T00:00:00.000Z';
	const slidePlan = {
		id: 'brief-slide',
		type: 'weekly',
		week: {
			items: [
				{
					id: idA,
					title: 'Keep the day',
					guide: { summary: 'One take after a lost day.', script: 'Say the line.', steps: [{ title: 'Stand here' }] }
				},
				{ id: idB, title: 'Already done' },
				{ id: idC, title: 'After that' }
			]
		},
		todos: {
			items: [
				{ id: idTask, text: 'Call them' },
				{ id: 'hold-tick', text: 'Leave this tick' }
			]
		}
	};
	{
		// These posts sit on top of the 10-call ingest budget. Clear it so the
		// later posts, and the 429 check at the end, still run.
		const scheduleDb = new Database(dbPath);
		scheduleDb.prepare(`DELETE FROM rate_limit WHERE bucket LIKE 'ingest:%'`).run();
		scheduleDb.close();
	}
	const slidePost = await api('/api/v1/ingest', { method: 'POST', bearer: token, body: slidePlan });
	check(slidePost.status === 200, `future plan ingest (${slidePost.status})`);
	{
		const scheduleDb = new Database(dbPath);
		scheduleDb.prepare('UPDATE week_item SET base_date = ?, scheduled_on = NULL WHERE ingest_id = ? AND is_current = 1').run(lostA, idA);
		scheduleDb.prepare('UPDATE week_item SET base_date = ?, scheduled_on = NULL, done = 1, done_at = ? WHERE ingest_id = ? AND is_current = 1').run(lostB, doneAt, idB);
		scheduleDb.prepare('UPDATE week_item SET base_date = ?, scheduled_on = NULL WHERE ingest_id = ? AND is_current = 1').run(later, idC);
		scheduleDb.prepare('UPDATE todo SET base_date = ?, scheduled_on = NULL WHERE id = ?').run(lostA, idTask);
		scheduleDb.prepare('UPDATE todo SET done = 1, done_at = ? WHERE id = ?').run(holdAt, 'hold-tick');
		scheduleDb.close();
	}
	const slideAgain = await api('/api/v1/ingest', {
		method: 'POST',
		bearer: token,
		body: {
			id: 'brief-slide-2',
			type: 'weekly',
			week: {
				items: [
					{ id: idA, title: 'Keep the day' },
					{ id: idB, title: 'Already done' },
					{ id: idC, title: 'After that' }
				]
			},
			todos: {
				items: [
					{ id: idTask, text: 'Call them' },
					{ id: 'hold-tick', text: 'Leave this tick', done: false }
				]
			}
		}
	});
	check(slideAgain.status === 200, `reingest after a lost day (${slideAgain.status} ${typeof slideAgain.text === 'string' ? slideAgain.text.slice(0, 180) : ''})`);
	const readSchedule = () => {
		const scheduleDb = new Database(dbPath);
		const week = scheduleDb.prepare('SELECT ingest_id, base_date, scheduled_on, done, done_at, guide_json FROM week_item WHERE is_current = 1').all();
		const todos = scheduleDb.prepare('SELECT id, base_date, scheduled_on, done, done_at FROM todo WHERE id IN (?, ?)').all(idTask, 'hold-tick');
		scheduleDb.close();
		return { week, todos };
	};
	const slid = readSchedule();
	const shotOf = (rows, id) => rows.find((row) => row.ingest_id === id);
	const todoOf = (rows, id) => rows.find((row) => row.id === id);
	const shown = (row) => row.scheduled_on || row.base_date;
	check(shown(shotOf(slid.week, idA)) === zoneToday, 'lost shot moves to today');
	check(shown(shotOf(slid.week, idB)) === lostB && shotOf(slid.week, idB).done === 1 && shotOf(slid.week, idB).done_at === doneAt, 'done shot stays put');
	check(shown(shotOf(slid.week, idC)) === addIso(zoneToday, 2), 'later shot follows in order');
	check(shown(todoOf(slid.todos, idTask)) === addIso(zoneToday, 1), 'lost task takes the next free day');
	check(todoOf(slid.todos, 'hold-tick').done === 1 && todoOf(slid.todos, 'hold-tick').done_at === holdAt, 'ingest does not reset a done tick');
	check(String(shotOf(slid.week, idA).guide_json).includes('Say the line.'), 'omitted guide survives the reingest');
	check(slid.week.length === 3, 'nothing dropped from the shot list');

	const home = await api('/today', { cookie });
	check(home.status === 200 && home.text.includes('Keep the day') && home.text.includes('Stand here'), 'home leads with today and the guide');
	check(home.text.includes('Read the script'), 'home opens the script');
	const noted = await api('/api/v1/steps/comment', {
		method: 'POST',
		cookie,
		body: { parent_kind: 'week', parent_id: idA, index: 0, text: 'Light was flat' }
	});
	check(noted.status === 200 && noted.json.step?.comment === 'Light was flat', 'step comment saved');
	const withNotes = await api('/api/v1/todos', { bearer: token });
	const notedShot = withNotes.json.items.find((item) => item.kind === 'week' && item.id === idA);
	check(
		notedShot?.steps?.[0]?.index === 0 &&
			notedShot.steps[0].comment === 'Light was flat' &&
			typeof notedShot.steps[0].updated_at === 'string',
		'todos readback includes the step comment'
	);
	check(notedShot?.date === zoneToday, 'todos readback includes the scheduled date');

	const slideKept = await api('/api/v1/ingest', {
		method: 'POST',
		bearer: token,
		body: {
			id: 'brief-slide-3',
			type: 'weekly',
			week: {
				items: [
					{ id: idA, title: 'Keep the day', date: addIso(zoneToday, 40) },
					{ id: idB, title: 'Already done' },
					{ id: idC, title: 'After that' }
				]
			},
			todos: {
				items: [
					{ id: idTask, text: 'Call them', date: lostA },
					{ id: 'hold-tick', text: 'Leave this tick' }
				]
			}
		}
	});
	check(
		slideKept.status === 200,
		`explicit date ingest (${slideKept.status} ${typeof slideKept.text === 'string' ? slideKept.text.slice(0, 180) : ''})`
	);
	const afterDate = readSchedule();
	const movedA = shotOf(afterDate.week, idA);
	check(movedA.base_date === addIso(zoneToday, 40) && movedA.scheduled_on === null, 'a new date clears the override');
	check(shotOf(afterDate.week, idB).done === 1 && shotOf(afterDate.week, idB).done_at === doneAt, 'done tick still untouched');
	check(shown(shotOf(afterDate.week, idC)) === addIso(zoneToday, 2), 'omitted date keeps the slid day');
	check(shown(todoOf(afterDate.todos, idTask)) === addIso(zoneToday, 1), 'repeating the plan date keeps the override');
	check(todoOf(afterDate.todos, 'hold-tick').done_at === holdAt, 'hold tick still untouched');

	const studyStill = await api('/api/v1/study', { cookie });
	check(studyStill.json.reels_rules.blocks.length === 2, 'weekly post left reels rules');

	const clearReels = await api('/api/v1/ingest', {
		method: 'POST',
		bearer: token,
		body: { id: 'brief-reels-clear', type: 'ad_hoc', reels_rules: { blocks: [] } }
	});
	check(clearReels.status === 200, 'clear reels');
	const studyAfter = await api('/api/v1/study', { cookie });
	check(studyAfter.json.reels_rules.blocks.length === 0, 'reels cleared');
	check(studyAfter.json.study.blocks.length === 4, 'study kept');

	const exported = await api('/api/v1/me/export', { cookie });
	check(exported.status === 200 && exported.json.app === 'pokedex', 'export');
	check(!exported.text.includes(token) && !exported.text.includes(vapid.privateKey), 'export has no secrets');
	check(!exported.text.includes('public_key'), 'export has no credential key material');

	const badCode = await api('/api/v1/auth/setup/verify', { method: 'POST', body: { code: 'ZZZZ-ZZZZ' } });
	check(badCode.status === 401, 'bad setup code');
	const goodCode = await api('/api/v1/auth/setup/verify', { method: 'POST', body: { code: setupCode } });
	check(goodCode.status === 200, 'printed setup code works');

	const removed = await api('/api/v1/me/delete', {
		method: 'POST',
		cookie,
		body: { confirm: 'DELETE MY POKEDEX DATA', keep_passkey: true }
	});
	check(removed.status === 200, 'delete data');
	const after = await api('/api/v1/today', { cookie });
	check(after.status === 401, 'session cleared after delete');
	const again = await api('/api/v1/ingest', {
		method: 'POST',
		bearer: token,
		body: { id: 'after-delete', type: 'ad_hoc', today: { lesson: 'Back' } }
	});
	check(again.status === 200, 'ingest still works after delete');

	let saw429 = false;
	for (let i = 0; i < 12; i++) {
		const limited = await api('/api/v1/ingest', { method: 'POST', bearer: 'nope', body: {} });
		if (limited.status === 429) saw429 = true;
	}
	check(saw429, 'ingest rate limit');
	check(!logs.includes(vapid.privateKey) && !logs.includes(token), 'logs have no secrets');
} catch (error) {
	console.error(error);
	failures.push(error instanceof Error ? error.message : 'threw');
} finally {
	child.kill('SIGTERM');
	webhook.close();
	await new Promise((resolve) => setTimeout(resolve, 200));
}

if (failures.length) {
	console.error(`\n${failures.length} failure(s)`);
	if (logs) console.error(logs.slice(-2000));
	process.exit(1);
}
console.log('flow ok');
