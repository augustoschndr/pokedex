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

async function assertScrollbarsHidden(page, label) {
	const report = await page.evaluate(() => {
		const probe = document.createElement('div');
		probe.style.cssText =
			'position:absolute;top:0;left:0;width:80px;height:40px;overflow:scroll;visibility:hidden';
		const inner = document.createElement('div');
		inner.style.cssText = 'width:200px;height:80px';
		probe.appendChild(inner);
		document.body.appendChild(probe);
		const gutterX = probe.offsetWidth - probe.clientWidth;
		const gutterY = probe.offsetHeight - probe.clientHeight;
		const scrollbarWidth = getComputedStyle(document.documentElement).scrollbarWidth;
		probe.remove();
		const scrollers = [];
		for (const el of document.querySelectorAll('body *')) {
			const cs = getComputedStyle(el);
			const scrollsX =
				(cs.overflowX === 'auto' || cs.overflowX === 'scroll') && el.scrollWidth > el.clientWidth + 1;
			const scrollsY =
				(cs.overflowY === 'auto' || cs.overflowY === 'scroll') &&
				el.scrollHeight > el.clientHeight + 1;
			if (scrollsX || scrollsY) scrollers.push(el.className || el.tagName);
		}
		return {
			gutterX,
			gutterY,
			scrollbarWidth,
			overflowX: document.documentElement.scrollWidth - window.innerWidth,
			scrollers
		};
	});
	if (report.gutterX > 0 || report.gutterY > 0) {
		throw new Error(`${label} scrollbar gutter is ${report.gutterX}x${report.gutterY}`);
	}
	if (report.scrollbarWidth !== 'none') {
		throw new Error(`${label} scrollbar-width is ${report.scrollbarWidth}`);
	}
	if (report.overflowX > 1) throw new Error(`${label} overflows horizontally by ${report.overflowX}px`);
	if (report.scrollers.length) {
		throw new Error(`${label} has a nested scroller: ${report.scrollers.join(', ')}`);
	}
}

async function assertStepFits(page, label) {
	await assertScrollbarsHidden(page, label);
	const report = await page.evaluate(() => ({
		overflow: document.documentElement.scrollWidth - window.innerWidth,
		extra: document.documentElement.scrollHeight - window.innerHeight
	}));
	if (report.overflow > 1) throw new Error(`${label} overflows horizontally by ${report.overflow}px`);
	if (report.extra > 4) throw new Error(`${label} is ${report.extra}px taller than 667`);
}

async function assertFits(page, label) {
	await assertScrollbarsHidden(page, label);
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
	await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'light' });
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
	await page.getByRole('heading', { name: 'Add to Home Screen', exact: true }).waitFor();
	await page.getByText('Edit Actions').waitFor();
	await page.getByText('bottom toolbar').waitFor();
	const installish = await page.getByRole('button', { name: /install|allow|add to home screen/i }).count();
	if (installish) throw new Error('iOS onboarding shows a button that claims to install');
	await assertStepFits(page, 'ios-safari');
	await shot(page, 'onboarding-ios-safari');
	await shot(page, 'onboarding-home');

	const cookies = await context.cookies();
	const standalone = await browser.newContext({
		viewport: { width: 375, height: 667 },
		deviceScaleFactor: 2,
		isMobile: true,
		hasTouch: true,
		userAgent:
			'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1'
	});
	await standalone.addCookies(cookies);
	await standalone.addInitScript(() => {
		Object.defineProperty(window.navigator, 'standalone', { configurable: true, get: () => true });
		const original = window.matchMedia.bind(window);
		window.matchMedia = (query) => {
			if (query === '(display-mode: standalone)') {
				return {
					matches: true,
					media: query,
					onchange: null,
					addListener() {},
					removeListener() {},
					addEventListener() {},
					removeEventListener() {},
					dispatchEvent() {
						return false;
					}
				};
			}
			return original(query);
		};
	});
	const home = await standalone.newPage();
	home.setDefaultTimeout(12000);
	await home.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'light' });
	await home.goto(origin + '/onboarding', { waitUntil: 'networkidle' });
	await home.getByRole('heading', { name: 'Notes, not noise' }).waitFor();
	await home.getByText('Home Screen app').waitFor();
	await assertStepFits(home, 'notifications');
	await shot(home, 'onboarding-notifications');
	await home.getByRole('button', { name: 'Not now' }).click();
	await home.waitForURL('**/today');
	await standalone.close();

	await page.goto(origin + '/today', { waitUntil: 'networkidle' });

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

	await page.goto(origin + '/today', { waitUntil: 'networkidle' });
	await page.getByRole('heading', { name: 'Prep day' }).waitFor();
	await page.getByText(/— in \d+ days|— tomorrow/).waitFor();
	await shot(page, 'today-prep');
	await assertFits(page, 'today-prep');
	await page.goto(origin + '/week', { waitUntil: 'networkidle' });
	await page.locator('.day-line.today').waitFor();
	await page.getByText('Nothing scheduled').first().waitFor();
	await shot(page, 'week-calendar');
	await assertFits(page, 'week-calendar');
	await page.goto(origin + '/settings', { waitUntil: 'networkidle' });
	await page.getByRole('radiogroup', { name: 'Theme' }).waitFor();
	await page.getByRole('radio', { name: 'System' }).waitFor();
	await assertScrollbarsHidden(page, 'settings-light');
	await shot(page, 'settings-light');

	await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'dark' });
	const darkShots = [
		['today-prep-dark', '/today', 'Prep day'],
		['week-calendar-dark', '/week', 'This week'],
		['settings-dark', '/settings', 'Settings']
	];
	for (const [name, href, heading] of darkShots) {
		await page.goto(origin + href, { waitUntil: 'networkidle' });
		await page.getByRole('heading', { name: heading, exact: true }).waitFor();
		const theme = await page.evaluate(() => document.documentElement.dataset.theme);
		if (theme !== 'dark') throw new Error(`${name} resolved theme is ${theme}`);
		await shot(page, name);
		if (href === '/settings') await assertScrollbarsHidden(page, name);
		else await assertFits(page, name);
	}
	await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'light' });

	await page.goto(origin + '/settings', { waitUntil: 'networkidle' });
	await shot(page, 'settings');
	await assertScrollbarsHidden(page, 'settings');
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
