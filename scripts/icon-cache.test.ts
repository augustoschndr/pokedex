import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';
import {
	ICON_REV,
	MANIFEST_CACHE,
	ROOT_TOUCH_CACHE,
	VERSIONED_CACHE,
	appleTouchHref,
	isPublicIconPath,
	manifestHref,
	versionedIcon
} from '../src/lib/icons.ts';

test('icon urls carry the revision and the root probes stay public', () => {
	assert.equal(ICON_REV, 'v4');
	assert.equal(appleTouchHref, '/icons/apple-touch-icon-v4.png');
	assert.equal(versionedIcon('icon-192.png'), '/icons/icon-192-v4.png');
	assert.equal(versionedIcon('favicon-32-dark.png'), '/icons/favicon-32-dark-v4.png');
	assert.equal(manifestHref, '/manifest.webmanifest?v=v4');
	assert.equal(isPublicIconPath('/apple-touch-icon.png'), true);
	assert.equal(isPublicIconPath('/apple-touch-icon-precomposed.png'), true);
	assert.equal(isPublicIconPath('/icons/icon-512-v4.png'), true);
	assert.equal(isPublicIconPath('/today'), false);
	assert.match(VERSIONED_CACHE, /immutable/);
	assert.match(ROOT_TOUCH_CACHE, /max-age=300/);
	assert.match(MANIFEST_CACHE, /max-age=0/);
});

test('committed touch icon is a 180px png outside the static directory', () => {
	const png = fs.readFileSync('src/lib/brand/icons/apple-touch-icon.png');
	assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
	assert.equal(png.readUInt32BE(16), 180);
	assert.equal(png.readUInt32BE(20), 180);
	assert.equal(fs.existsSync('static/icons/apple-touch-icon.png'), false);
	assert.equal(fs.existsSync('static/apple-touch-icon.png'), false);
});

test('the service worker does not cache-first icons and names the new artwork', () => {
	const worker = fs.readFileSync('static/service-worker.js', 'utf8');
	assert.match(worker, /const CACHE = 'pokedex-v6'/);
	assert.match(worker, /const immutable = url\.pathname\.startsWith\('\/_app\/immutable\/'\);/);
	assert.match(worker, /pathname\.startsWith\('\/icons\/'\)/);
	assert.match(worker, /pathname === '\/apple-touch-icon\.png'/);
	assert.match(worker, /pathname === '\/manifest\.webmanifest'/);
	assert.match(worker, new RegExp(`/icons/icon-192-${ICON_REV}\\.png`));
	assert.doesNotMatch(worker, /\/icons\/icon-192\.png/);
	assert.doesNotMatch(worker, /startsWith\('\/icons\/'\)[\s\S]{0,40}immutable/);
});

test('the shell head no longer points at the unversioned touch icon', () => {
	const html = fs.readFileSync('src/app.html', 'utf8');
	const layout = fs.readFileSync('src/routes/+layout.svelte', 'utf8');
	assert.doesNotMatch(html, /apple-touch-icon/);
	assert.doesNotMatch(html, /rel="manifest"/);
	assert.match(layout, /appleTouchHref/);
	assert.match(layout, /manifestHref/);
});
