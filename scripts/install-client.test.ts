import assert from 'node:assert/strict';
import { test } from 'node:test';
import { classifyInstall, homeScreenCopy, notificationCopy } from '../src/lib/install.ts';

const iphoneSafari =
	'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1';

test('iPhone Safari teaches the manual steps and names the bottom Share button', () => {
	const client = classifyInstall({
		ua: iphoneSafari,
		platform: 'iPhone',
		maxTouchPoints: 5,
		standalone: false
	});
	assert.equal(client.surface, 'ios-safari');
	assert.equal(client.ipad, false);
	const copy = homeScreenCopy(client);
	assert.ok(copy);
	assert.equal(copy.title, 'Add to Home Screen');
	assert.match(copy.steps[0].body, /bottom toolbar/);
	assert.equal(copy.steps[0].shareIcon, true);
	assert.match(copy.steps[1].title, /Add to Home Screen/);
	assert.match(copy.steps[1].body, /Edit Actions/);
	assert.match(copy.steps[2].title, /^Tap Add$/);
	assert.match(copy.steps[2].body, /Home Screen icon/);
});

test('iPad Safari puts Share in the top toolbar', () => {
	const client = classifyInstall({
		ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15',
		platform: 'MacIntel',
		maxTouchPoints: 5,
		standalone: false
	});
	assert.equal(client.surface, 'ios-safari');
	assert.equal(client.ipad, true);
	const copy = homeScreenCopy(client);
	assert.match(copy!.kicker, /iPad/);
	assert.match(copy!.steps[0].body, /toolbar at the top/);
});

test('iPhone Chrome offers Safari or that browser share menu', () => {
	const client = classifyInstall({
		ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/131.0.6778.73 Mobile/15E148 Safari/604.1',
		platform: 'iPhone',
		maxTouchPoints: 5,
		standalone: false
	});
	assert.equal(client.surface, 'ios-browser');
	assert.equal(client.browserName, 'Chrome');
	const copy = homeScreenCopy(client);
	assert.match(copy!.lede, /Safari/);
	assert.match(copy!.lede, /share menu/i);
	assert.match(copy!.steps[1].body, /Edit Actions/);
});

test('iPad Chrome is still a non-Safari iOS browser', () => {
	const client = classifyInstall({
		ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/131.0.6778.73 Mobile/15E148 Safari/604.1',
		platform: 'MacIntel',
		maxTouchPoints: 5,
		standalone: false
	});
	assert.equal(client.surface, 'ios-browser');
	assert.equal(client.ipad, true);
	assert.equal(client.browserName, 'Chrome');
});

test('Firefox on iOS is not treated as Safari', () => {
	const client = classifyInstall({
		ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/132.0 Mobile/15E148 Safari/605.1.15',
		platform: 'iPhone',
		maxTouchPoints: 5,
		standalone: false
	});
	assert.equal(client.surface, 'ios-browser');
	assert.equal(client.browserName, 'Firefox');
});

test('an in-app browser is sent to Safari', () => {
	const client = classifyInstall({
		ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 312.0.0.0.0',
		platform: 'iPhone',
		maxTouchPoints: 5,
		standalone: false
	});
	assert.equal(client.surface, 'ios-inapp');
	assert.equal(client.browserName, 'Instagram');
	const copy = homeScreenCopy(client);
	assert.match(copy!.title, /Safari/);
	assert.match(copy!.steps[0].body, /Open in Safari/);
	assert.match(copy!.steps.map((step) => step.body).join(' '), /Edit Actions/);
});

test('a bare web view is not Safari', () => {
	const client = classifyInstall({
		ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148',
		platform: 'iPhone',
		maxTouchPoints: 5,
		standalone: false
	});
	assert.equal(client.surface, 'ios-inapp');
	assert.equal(client.browserName, null);
});

test('standalone skips the Home Screen guide and explains notifications', () => {
	const client = classifyInstall({
		ua: iphoneSafari,
		platform: 'iPhone',
		maxTouchPoints: 5,
		standalone: true
	});
	assert.equal(client.surface, 'standalone');
	assert.equal(client.ios, true);
	assert.equal(homeScreenCopy(client), null);
	assert.match(notificationCopy(client), /Home Screen app/);
	assert.match(notificationCopy(client), /this one/);
});

test('Android and desktop stay on the native install path', () => {
	const android = classifyInstall({
		ua: 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36',
		platform: 'Linux armv8l',
		maxTouchPoints: 5,
		standalone: false
	});
	assert.equal(android.surface, 'installable');
	assert.equal(android.ios, false);
	assert.equal(homeScreenCopy(android), null);
	assert.doesNotMatch(notificationCopy(android), /Home Screen/);

	const desktop = classifyInstall({
		ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
		platform: 'Win32',
		maxTouchPoints: 0,
		standalone: false
	});
	assert.equal(desktop.surface, 'installable');

	const macSafari = classifyInstall({
		ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15',
		platform: 'MacIntel',
		maxTouchPoints: 0,
		standalone: false
	});
	assert.equal(macSafari.ios, false);
	assert.equal(macSafari.surface, 'installable');
});
