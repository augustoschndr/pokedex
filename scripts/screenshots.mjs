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
const iconRev = fs.readFileSync(path.join(root, 'src/lib/icons.ts'), 'utf8').match(/ICON_REV = '([^']+)'/)?.[1];
if (!iconRev) throw new Error('ICON_REV missing');
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
			const pane = el.classList?.contains('pane');
			if (scrollsX || (scrollsY && !pane)) scrollers.push(el.className || el.tagName);
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
		const scroller = document.querySelector('.pane.is-active') || document.scrollingElement;
		const main = scroller?.querySelector('main') ?? document.querySelector('main');
		const overflow = document.documentElement.scrollWidth - window.innerWidth;
		if (!bar || !main || !scroller) return { overflow, overlap: 0, short: true };
		const before = scroller.scrollTop;
		scroller.scrollTop = scroller.scrollHeight;
		const barTop = bar.getBoundingClientRect().top;
		const last = main.lastElementChild ?? main;
		const lastBottom = last.getBoundingClientRect().bottom;
		scroller.scrollTop = before;
		return { overflow, overlap: Math.ceil(lastBottom - barTop), short: false };
	});
	if (report.overflow > 1) throw new Error(`${label} overflows horizontally by ${report.overflow}px`);
	if (!report.short && report.overlap > 0) {
		throw new Error(`${label} content sits ${report.overlap}px under the tab bar`);
	}
}

async function assertHeaderClear(page, name, { width, height, top, bottom, scheme }) {
	await page.setViewportSize({ width, height });
	await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: scheme });
	await page.waitForFunction((expected) => document.documentElement.dataset.theme === expected, scheme);
	await page.evaluate(({ top, bottom }) => {
		const root = document.documentElement;
		root.style.setProperty('--sat', `${top}px`);
		root.style.setProperty('--sab', `${bottom}px`);
	}, { top, bottom });
	const box = await page.evaluate(() => {
		const button = document.querySelector('.pane.detail .back-btn');
		const kicker = document.querySelector('.pane.detail .kicker');
		const bar = document.querySelector('.tabbar');
		const shell = document.querySelector('.app-shell');
		return {
			buttonTop: button ? button.getBoundingClientRect().top : -1,
			buttonWidth: button ? button.getBoundingClientRect().width : 0,
			buttonHeight: button ? button.getBoundingClientRect().height : 0,
			kickerTop: kicker ? kicker.getBoundingClientRect().top : -1,
			barGap: bar ? window.innerHeight - bar.getBoundingClientRect().bottom : -1,
			shellTop: shell ? shell.getBoundingClientRect().top : -1,
			shellBottom: shell ? shell.getBoundingClientRect().bottom : -1,
			innerHeight: window.innerHeight
		};
	});
	const label = name || `${width}x${height}`;
	if (box.buttonTop < top + 12) throw new Error(`${label} back button starts at ${box.buttonTop}, inset is ${top}`);
	if (box.buttonWidth < 44 || box.buttonHeight < 44) {
		throw new Error(`${label} back button is ${box.buttonWidth}x${box.buttonHeight}`);
	}
	if (box.kickerTop < top) throw new Error(`${label} eyebrow starts at ${box.kickerTop}, inset is ${top}`);
	if (Math.abs(box.shellTop) > 1 || Math.abs(box.shellBottom - box.innerHeight) > 1) {
		throw new Error(`${label} shell does not fill the screen (${box.shellTop}..${box.shellBottom} of ${box.innerHeight})`);
	}
	if (Math.abs(box.barGap - (10 + bottom)) > 2) {
		throw new Error(`${label} tab bar gap is ${box.barGap}, expected ${10 + bottom}`);
	}
	if (name) await shot(page, name);
}

const browser = await chromium.launch({
	headless: true,
	args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream']
});
try {
	await waitHealth();
	const ingested = await fetch(`${origin}/api/v1/ingest`, {
		method: 'POST',
		headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
		body: sample
	});
	if (!ingested.ok) throw new Error(await ingested.text());

	const phone = {
		viewport: { width: 375, height: 667 },
		deviceScaleFactor: 2,
		isMobile: true,
		hasTouch: true,
		userAgent:
			'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1'
	};
	const context = await browser.newContext(phone);
	await context.grantPermissions(['camera', 'microphone']);
	await context.addInitScript(() => {
		const mark = () => {
			const root = document.documentElement;
			if (root) root.dataset.splash = 'skip';
		};
		mark();
		document.addEventListener('readystatechange', mark);
		new MutationObserver(mark).observe(document, { childList: true, subtree: true });
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

	await page.goto(origin + '/week', { waitUntil: 'networkidle' });
	const hit = await page.evaluate(() => {
		const meta = document.querySelector('.pane.is-active .shot .meta');
		if (!(meta instanceof HTMLElement)) return 'missing';
		meta.scrollIntoView({ block: 'center' });
		const rect = meta.getBoundingClientRect();
		const target = document.elementFromPoint(rect.left + rect.width / 2, rect.top + 8);
		const link = target instanceof Element ? target.closest('a') : null;
		if (!link?.classList.contains('stretch')) return target instanceof Element ? target.className : 'none';
		link.click();
		return 'ok';
	});
	if (hit !== 'ok') throw new Error(`shot body is not the link (${hit})`);
	await page.waitForURL('**/week/*');
	const shotPath = new URL(page.url()).pathname;
	if (!/^\/week\/.+/.test(shotPath)) throw new Error(`shot body stayed on ${shotPath}`);

	await page.goto(origin + '/you', { waitUntil: 'networkidle' });
	const you = page.locator('.pane.is-active');
	await you.getByRole('button', { name: /Mark done: Add the Cloudflare/ }).click();
	await page.waitForFunction(() => location.pathname === '/you');
	await you.getByText('Add the Cloudflare').waitFor();
	await shot(page, 'tab-you-checked');
	await assertFits(page, 'you-checked');

	await page.goto(origin + '/today', { waitUntil: 'networkidle' });
	const zoneToday = new Intl.DateTimeFormat('en-CA', {
		timeZone: 'America/Sao_Paulo',
		year: 'numeric',
		month: '2-digit',
		day: '2-digit'
	}).format(new Date());
	if (zoneToday < '2026-11-23') {
		await page.getByRole('heading', { name: 'Prep day' }).waitFor();
		await page.getByText(/— in \d+ days|— tomorrow/).waitFor();
	} else if (zoneToday === '2026-11-23') {
		await page.getByRole('heading', { name: 'Origin-story long-form' }).waitFor();
	} else {
		await page.getByRole('heading', { name: 'No brief today' }).waitFor();
	}
	await shot(page, 'today-prep');
	await assertFits(page, 'today-prep');
	await shot(page, 'tabbar-light');
	const tabChrome = await page.evaluate(() => {
		const bar = document.querySelector('.tabbar');
		const link = bar?.querySelector('a');
		const icon = bar?.querySelector('svg');
		const label = bar?.querySelector('.visually-hidden');
		const current = bar?.querySelector('[aria-current="page"]');
		return {
			height: bar ? bar.getBoundingClientRect().height : 0,
			link: link ? link.getBoundingClientRect().height : 0,
			icon: icon ? icon.getBoundingClientRect().width : 0,
			label: label ? label.getBoundingClientRect().width : 99,
			current: current?.getAttribute('aria-current') ?? ''
		};
	});
	if (tabChrome.height > 56 || tabChrome.height < 50) throw new Error(`tab bar height is ${tabChrome.height}`);
	if (tabChrome.link < 44) throw new Error(`tab target is ${tabChrome.link}px`);
	if (tabChrome.icon < 24 || tabChrome.icon > 28) throw new Error(`tab icon is ${tabChrome.icon}px`);
	if (tabChrome.label > 2) throw new Error('tab label is visible');
	if (tabChrome.current !== 'page') throw new Error('active tab is not marked');

	const barBefore = await page.locator('.tabbar').boundingBox();
	const layerBox = await page.locator('.pager').boundingBox();
	if (!barBefore || !layerBox) throw new Error('swipe targets missing');
	const frame = await page.evaluate(() => {
		const bar = document.querySelector('.tabbar');
		const pager = document.querySelector('.pager');
		const shell = document.querySelector('.app-shell');
		return {
			insidePager: Boolean(pager && bar && pager.contains(bar)),
			barParent: bar?.parentElement === shell,
			shellPosition: shell ? getComputedStyle(shell).position : ''
		};
	});
	if (frame.insidePager || !frame.barParent || frame.shellPosition !== 'fixed') {
		throw new Error(`tab bar is not fixed to the shell (${JSON.stringify(frame)})`);
	}
	const drag = await page.evaluate(() => {
		const width = window.innerWidth;
		for (let y = 200; y < window.innerHeight - 96; y += 20) {
			const hit = document.elementFromPoint(width * 0.78, y);
			if (hit?.closest('a, button, input, textarea, select, .tabbar, .check')) continue;
			return y;
		}
		return 200;
	});
	await page.mouse.move(layerBox.x + layerBox.width * 0.78, drag);
	await page.mouse.down();
	await page.mouse.move(layerBox.x + layerBox.width * 0.22, drag + 2, { steps: 20 });
	await page.evaluate(
		() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
	);
	const barMid = await page.locator('.tabbar').boundingBox();
	const swipeState = await page.evaluate(() => {
		const layer = document.querySelector('.pager');
		const bar = document.querySelector('.tabbar');
		const shell = document.querySelector('.app-shell');
		const panes = [...document.querySelectorAll('.pager .pane')].map((node) => {
			const rect = node.getBoundingClientRect();
			return { x: rect.x, right: rect.right, label: node.querySelector('h1')?.textContent ?? '' };
		});
		return {
			layer: layer ? getComputedStyle(layer).transform : '',
			bar: bar ? getComputedStyle(bar).transform : '',
			overflow: document.documentElement.scrollWidth - window.innerWidth,
			inner: shell ? shell.scrollWidth - shell.clientWidth : 0,
			panes
		};
	});
	if (!barMid) throw new Error('tab bar missing mid-swipe');
	if (Math.abs(barBefore.x - barMid.x) > 1 || Math.abs(barBefore.y - barMid.y) > 1) {
		throw new Error(`tab bar moved during swipe (${barBefore.x},${barBefore.y} -> ${barMid.x},${barMid.y})`);
	}
	if (swipeState.layer === 'none') throw new Error('page did not follow the swipe');
	if (swipeState.bar !== 'none') throw new Error(`tab bar transform is ${swipeState.bar}`);
	if (swipeState.overflow > 1 || swipeState.inner > 1) {
		throw new Error(`swipe overflow ${swipeState.overflow}/${swipeState.inner}`);
	}
	const visible = swipeState.panes.filter((pane) => pane.right > 8 && pane.x < 367);
	if (visible.length < 2) throw new Error(`neighbor is not on screen (${JSON.stringify(swipeState.panes)})`);
	await shot(page, 'tabbar-swipe');
	await page.mouse.up();
	await page.waitForURL('**/week');
	const barAfter = await page.locator('.tabbar').boundingBox();
	if (!barAfter || Math.abs(barBefore.x - barAfter.x) > 1 || Math.abs(barBefore.y - barAfter.y) > 1) {
		throw new Error('tab bar moved after the page changed');
	}
	await page.mouse.move(8, 280);
	await page.mouse.down();
	await page.mouse.move(230, 282, { steps: 20 });
	const barBack = await page.locator('.tabbar').boundingBox();
	if (!barBack || Math.abs(barBefore.x - barBack.x) > 1 || Math.abs(barBefore.y - barBack.y) > 1) {
		throw new Error(`tab bar moved on the return swipe (${barBefore.x},${barBefore.y} -> ${barBack.x},${barBack.y})`);
	}
	await page.mouse.up();
	await page.waitForURL('**/today');

	const splashContext = await browser.newContext(phone);
	await splashContext.addCookies(await context.cookies());
	const splashPage = await splashContext.newPage();
	await splashPage.emulateMedia({ reducedMotion: 'no-preference', colorScheme: 'light' });
	await splashPage.goto(origin + '/today?splash=1', { waitUntil: 'networkidle' });
	await splashPage.locator('#boot[data-ready]').waitFor();
	await splashPage.locator('#boot svg').waitFor();
	await splashPage.waitForFunction(() => document.documentElement.dataset.theme === 'light');
	await shot(splashPage, 'splash');
	await splashContext.close();

	await page.evaluate(async () => {
		await fetch('/api/v1/me/theme', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ theme: 'dark' })
		});
	});
	const darkSplash = await browser.newContext(phone);
	await darkSplash.addCookies(await context.cookies());
	await darkSplash.addInitScript(() => {
		localStorage.setItem('pokedex-theme', 'dark');
	});
	const darkSplashPage = await darkSplash.newPage();
	await darkSplashPage.emulateMedia({ reducedMotion: 'no-preference', colorScheme: 'light' });
	await darkSplashPage.goto(origin + '/today?splash=1', { waitUntil: 'networkidle' });
	await darkSplashPage.locator('#boot[data-ready]').waitFor();
	await darkSplashPage.waitForFunction(() => document.documentElement.dataset.theme === 'dark');
	await shot(darkSplashPage, 'splash-dark');
	await darkSplash.close();
	await page.evaluate(async () => {
		await fetch('/api/v1/me/theme', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ theme: 'system' })
		});
	});

	async function iconBoard(bg, src, ink, name) {
		const iconPage = await context.newPage();
		await iconPage.setContent(
			`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>
				html,body{margin:0;height:100%;background:${bg}}
				body{display:grid;place-items:center;font-family:"Instrument Sans",sans-serif}
				figure{margin:0;text-align:center}
				img{width:60px;height:60px;border-radius:13px;display:block}
				figcaption{margin-top:4px;font-size:11px;letter-spacing:-0.01em;color:${ink}}
			</style><figure><img src="${src}" alt="Pokedex"><figcaption>Pokedex</figcaption></figure>`,
			{ waitUntil: 'networkidle' }
		);
		await shot(iconPage, name);
		await iconPage.close();
	}
	await iconBoard('#FBF7F3', origin + `/icons/apple-touch-icon-${iconRev}.png`, '#171513', 'icon-light');
	await iconBoard('#1C1916', origin + `/icons/apple-touch-icon-dark-${iconRev}.png`, '#F6F1EA', 'icon-dark');
	await page.goto(origin + '/week/2026-11-23-origin', { waitUntil: 'networkidle' });
	await page.getByRole('button', { name: 'Read the script' }).waitFor();
	await page.getByRole('heading', { name: 'Film the origin-story long-form' }).waitFor();
	await assertFits(page, 'task-detail');
	await shot(page, 'task-detail');
	await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'dark' });
	await page.waitForFunction(() => document.documentElement.dataset.theme === 'dark');
	await shot(page, 'task-detail-dark');
	await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'light' });
	await page.waitForFunction(() => document.documentElement.dataset.theme === 'light');
	await assertHeaderClear(page, 'header-light', { width: 375, height: 667, top: 20, bottom: 0, scheme: 'light' });
	await assertHeaderClear(page, 'header-dark', { width: 375, height: 667, top: 20, bottom: 0, scheme: 'dark' });
	await assertHeaderClear(page, null, { width: 390, height: 844, top: 47, bottom: 34, scheme: 'light' });
	await page.setViewportSize({ width: 375, height: 667 });
	await page.evaluate(() => {
		document.documentElement.style.removeProperty('--sat');
		document.documentElement.style.removeProperty('--sab');
	});
	await page.emulateMedia({ reducedMotion: 'no-preference', colorScheme: 'light' });
	await page.getByRole('button', { name: 'Read the script' }).click();
	await page.locator('.prompter-text').waitFor();
	await page.locator('.prompter-count').waitFor({ state: 'detached' });
	await page.getByRole('button', { name: 'Pause' }).click();
	await page.locator('.prompter-scroll').evaluate((node) => {
		node.scrollTop = 0;
	});
	await page.getByRole('button', { name: 'Play' }).waitFor();
	await page.getByRole('slider', { name: 'Scroll speed' }).waitFor();
	await shot(page, 'task-script');
	await page.getByRole('button', { name: 'Show camera' }).click();
	await page.locator('video.prompter-camera').waitFor();
	await page.waitForFunction(() => {
		const video = document.querySelector('video.prompter-camera');
		return video instanceof HTMLVideoElement && video.videoWidth > 0;
	});
	await shot(page, 'task-camera');
	await page.getByRole('button', { name: 'Record' }).click();
	await page.getByRole('button', { name: /Stop recording/ }).waitFor();
	await page.waitForTimeout(400);
	await page.getByRole('button', { name: /Stop recording/ }).click();
	await page.getByRole('button', { name: 'Save to Photos' }).waitFor();
	await page.getByText('Tap Save Video to put it in Photos').waitFor();
	await shot(page, 'task-save');
	await page.getByRole('button', { name: 'Discard' }).click();
	await page.getByRole('button', { name: 'Close' }).click();
	await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'light' });
	await page.goto(origin + '/week/plan', { waitUntil: 'networkidle' });
	await page.getByRole('heading', { name: 'Plan' }).waitFor();
	await page.getByText('Logbook launch').waitFor();
	await assertFits(page, 'plan-progress');
	await shot(page, 'plan-progress');
	await page.goto(origin + '/week', { waitUntil: 'networkidle' });
	await page.locator('.day-line.today, .card.day.today').first().waitFor();
	await page.getByText('Nothing scheduled').first().waitFor();
	await shot(page, 'week-calendar');
	await assertFits(page, 'week-calendar');
	await page.goto(origin + '/settings', { waitUntil: 'networkidle' });
	await page.getByRole('radiogroup', { name: 'Theme' }).waitFor();
	await page.getByRole('radio', { name: 'System' }).waitFor();
	await assertScrollbarsHidden(page, 'settings-light');
	await shot(page, 'settings-light');

	await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'dark' });
	const todayHeading = zoneToday < '2026-11-23' ? 'Prep day' : zoneToday === '2026-11-23' ? /Origin-story/ : /No brief today/;
	const darkShots = [
		['today-prep-dark', '/today', todayHeading],
		['week-calendar-dark', '/week', 'This week'],
		['settings-dark', '/settings', 'Settings']
	];
	for (const [name, href, heading] of darkShots) {
		await page.goto(origin + href, { waitUntil: 'networkidle' });
		await page.getByRole('heading', { name: heading, exact: typeof heading === 'string' }).waitFor();
		const theme = await page.evaluate(() => document.documentElement.dataset.theme);
		if (theme !== 'dark') throw new Error(`${name} resolved theme is ${theme}`);
		await shot(page, name);
		if (href === '/today') await shot(page, 'tabbar-dark');
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
	await page.evaluate(() => {
		const pane = document.querySelector('.pane.is-active');
		if (pane) pane.scrollTop = pane.scrollHeight;
		else window.scrollTo(0, document.documentElement.scrollHeight);
	});
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
