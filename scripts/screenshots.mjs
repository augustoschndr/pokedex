/**
 * Mobile screenshots at the iPhone SE (2nd gen) CSS viewport: 375x667.
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { chromium } from 'playwright';
import { generateVAPIDKeys } from 'web-push';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const port = 4173;
const origin = `http://localhost:${port}`;
const token = crypto.randomBytes(24).toString('hex');
const sessionSecret = crypto.randomBytes(24).toString('hex');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pokedex-shots-'));
const dbPath = path.join(dir, 'pokedex.db');
const vapid = generateVAPIDKeys();
const outDir = process.env.SHOT_DIR || path.join(root, 'docs/screenshots');
fs.mkdirSync(outDir, { recursive: true });
const sample = fs.readFileSync(path.join(root, 'docs/example-payload.json'));

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
		WEBAUTHN_RP_ID: 'localhost',
		WEBAUTHN_RP_NAME: 'Pokedex',
		SETUP_CODE: 'PKDX-2345',
		TZ: 'America/Sao_Paulo',
		SEED_DEMO: '0'
	},
	stdio: ['ignore', 'pipe', 'pipe']
});
child.stdout.on('data', (buf) => process.stdout.write(buf));
child.stderr.on('data', (buf) => process.stderr.write(buf));

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
	throw new Error('server did not start');
}

async function shot(page, name) {
	await page.evaluate(() => document.fonts.ready);
	await page.waitForTimeout(150);
	const file = path.join(outDir, `${name}.png`);
	await page.screenshot({ path: file, fullPage: false });
	console.log('shot', file);
}

async function assertFits(page, label) {
	const report = await page.evaluate(() => {
		const bar = document.querySelector('.tabbar');
		const main = document.querySelector('main');
		const overflow = document.documentElement.scrollWidth - window.innerWidth;
		if (!bar || !main) return { overflow, overlap: 0, short: true };
		const before = window.scrollY;
		window.scrollTo(0, document.documentElement.scrollHeight);
		const barTop = bar.getBoundingClientRect().top;
		const last = main.lastElementChild ?? main;
		const lastBottom = last.getBoundingClientRect().bottom;
		window.scrollTo(0, before);
		return { overflow, overlap: Math.ceil(lastBottom - barTop), short: false };
	});
	if (report.overflow > 1) throw new Error(`${label} overflows horizontally by ${report.overflow}px`);
	if (!report.short && report.overlap > 0) {
		throw new Error(`${label} content sits ${report.overlap}px under the tab bar`);
	}
}

const browser = await chromium.launch({ headless: true });
try {
	await waitHealth();
	const ingested = await fetch(`${origin}/api/v1/ingest`, {
		method: 'POST',
		headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
		body: sample
	});
	if (!ingested.ok) throw new Error(await ingested.text());

	const context = await browser.newContext({
		viewport: { width: 375, height: 667 },
		deviceScaleFactor: 2,
		isMobile: true,
		hasTouch: true,
		userAgent:
			'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1'
	});
	const page = await context.newPage();
	page.setDefaultTimeout(12000);
	page.setDefaultNavigationTimeout(20000);
	page.on('console', (msg) => {
		if (msg.type() === 'error' || msg.type() === 'warning') console.log('browser', msg.type(), msg.text());
	});
	page.on('pageerror', (err) => console.log('pageerror', err.message));
	await page.emulateMedia({ reducedMotion: 'reduce' });
	const client = await context.newCDPSession(page);
	await client.send('WebAuthn.enable');
	await client.send('WebAuthn.addVirtualAuthenticator', {
		options: {
			protocol: 'ctap2',
			ctap2Version: 'ctap2_1',
			transport: 'internal',
			hasResidentKey: true,
			hasUserVerification: true,
			isUserVerified: true,
			automaticPresenceSimulation: true
		}
	});

	await page.goto(origin + '/', { waitUntil: 'networkidle' });
	await shot(page, 'onboarding-welcome');
	await page.getByRole('link', { name: 'Get started' }).click();
	await page.waitForURL('**/setup?step=code');
	await shot(page, 'onboarding-code');
	await page.locator('#code').fill('PKDX-2345');
	await page.getByRole('button', { name: 'Next' }).click();
	await page.waitForURL('**/setup?step=passkey');
	await shot(page, 'onboarding-passkey');
	await page.getByRole('button', { name: 'Create passkey' }).click();
	await page.waitForURL('**/onboarding**');
	await shot(page, 'onboarding-notifications');
	await page.getByRole('link', { name: 'Not now' }).click();
	await page.waitForURL('**/onboarding?step=home');
	await shot(page, 'onboarding-home');
	await page.getByRole('button', { name: 'I added it' }).click();
	await page.waitForURL('**/today');

	const tabs = [
		['tab-today', '/today'],
		['tab-week', '/week'],
		['tab-you', '/you'],
		['tab-study', '/study'],
		['tab-decisions', '/decisions']
	];
	for (const [name, href] of tabs) {
		await page.goto(origin + href, { waitUntil: 'networkidle' });
		await shot(page, name);
		await assertFits(page, name);
	}

	await page.goto(origin + '/you', { waitUntil: 'networkidle' });
	await page.getByRole('button', { name: /Mark done: Add the Cloudflare/ }).click();
	await page.getByText('Add the Cloudflare').waitFor();
	await shot(page, 'tab-you-checked');
	await assertFits(page, 'you-checked');

	await page.goto(origin + '/settings', { waitUntil: 'networkidle' });
	await shot(page, 'settings');
	const settingsOverflow = await page.evaluate(
		() => document.documentElement.scrollWidth - window.innerWidth
	);
	if (settingsOverflow > 1) throw new Error('settings overflows');

	await page.goto(origin + '/today', { waitUntil: 'networkidle' });
	await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
	await shot(page, 'tab-today-end');
	await assertFits(page, 'today-end');

	await page.goto(origin + '/decisions', { waitUntil: 'domcontentloaded' });
	await page.getByRole('button', { name: 'Approve', exact: true }).click();
	await page.getByText('Approved', { exact: true }).waitFor();
	await page.getByRole('button', { name: 'Change answer' }).click();
	await page.locator('textarea').fill('Keep the founding price');
	await page.getByRole('button', { name: 'Send comment' }).click();
	await page.getByText('Commented', { exact: true }).waitFor();
	await page.getByText('Keep the founding price').waitFor();
} finally {
	await browser.close();
	child.kill('SIGTERM');
}
console.log('screenshots ok', outDir);
