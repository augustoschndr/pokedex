import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';
import { outcomeFromStatus, validVapidSubject } from '../src/lib/server/push-status.ts';

test('a vapid subject is a mailto or a public https url', () => {
	assert.equal(validVapidSubject('mailto:augusto@folderr.co'), true);
	assert.equal(validVapidSubject('https://pokedex.folderr.co'), true);
	assert.equal(validVapidSubject('augusto@folderr.co'), false);
	assert.equal(validVapidSubject('mailto:not-an-email'), false);
	assert.equal(validVapidSubject('http://pokedex.folderr.co'), false);
	assert.equal(validVapidSubject('https://localhost/contact'), false);
	assert.equal(validVapidSubject(''), false);
});

test('only a 2xx counts, and only 404 or 410 drops the row', () => {
	assert.deepEqual(outcomeFromStatus(201), { ok: true, drop: false });
	assert.deepEqual(outcomeFromStatus(404), { ok: false, drop: true });
	assert.deepEqual(outcomeFromStatus(410), { ok: false, drop: true });
	assert.deepEqual(outcomeFromStatus(403), { ok: false, drop: false });
	assert.deepEqual(outcomeFromStatus(413), { ok: false, drop: false });
	assert.deepEqual(outcomeFromStatus(0), { ok: false, drop: false });
});

test('the service worker always shows a notification and still handles the click', () => {
	const worker = fs.readFileSync('src/lib/pwa/service-worker.js', 'utf8');
	const pushAt = worker.indexOf("addEventListener('push'");
	const clickAt = worker.indexOf("addEventListener('notificationclick'");
	assert.ok(pushAt > 0 && clickAt > pushAt);
	const push = worker.slice(pushAt, clickAt);
	assert.match(push, /event\.waitUntil\(/);
	assert.match(push, /self\.registration\s*\.\s*showNotification\(/);
	const sender = fs.readFileSync('src/lib/server/push.ts', 'utf8');
	assert.match(sender, /TTL: 86400, urgency: 'high'/);
});

test('the status bar is outside the web view', () => {
	const html = fs.readFileSync('src/app.html', 'utf8');
	assert.match(html, /viewport-fit=cover/);
	assert.match(html, /apple-mobile-web-app-status-bar-style" content="default"/);
	assert.doesNotMatch(html, /content="black-translucent"/);
	const css = fs.readFileSync('src/app.css', 'utf8');
	assert.match(css, /padding: calc\(16px \+ var\(--sat\)\)/);
	assert.match(css, /bottom: calc\(var\(--tab-gap\) \+ var\(--sab\)\)/);
	assert.match(css, /\.prompter[\s\S]*padding: calc\(8px \+ var\(--sat\)\)/);
});
