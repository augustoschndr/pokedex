import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { test } from 'node:test';
import {
	cameraErrorMessage,
	clampSpeed,
	formatClock,
	micErrorMessage,
	pickRecorderMime,
	recordingExtension,
	shareRecording,
	takeFileName,
	takeFromChunks
} from '../src/lib/prompter.ts';

test('scroll speed stays inside the slider and remembers a blank value as the default', () => {
	assert.equal(clampSpeed(null), 48);
	assert.equal(clampSpeed('fast'), 48);
	assert.equal(clampSpeed(4), 16);
	assert.equal(clampSpeed(400), 120);
	assert.equal(clampSpeed(52.4), 52);
});

test('mp4 is preferred when the phone can record it', () => {
	assert.equal(
		pickRecorderMime((type) => type.startsWith('video/mp4')),
		'video/mp4;codecs=avc1'
	);
	assert.equal(pickRecorderMime((type) => type === 'video/webm'), 'video/webm');
	assert.equal(pickRecorderMime(() => false), '');
	assert.equal(recordingExtension('video/webm;codecs=vp8,opus'), 'webm');
	assert.equal(recordingExtension('video/mp4'), 'mp4');
});

test('a stopped take is a named file and the share sheet stays on the tap', async () => {
	const when = new Date(2026, 10, 23, 9, 5);
	assert.equal(takeFileName(when), 'pokedex-20261123-0905.mp4');
	assert.equal(takeFromChunks([], 'video/mp4', when), null);
	assert.equal(takeFromChunks([new Blob()], 'video/mp4', when), null);
	const file = takeFromChunks([new Blob(['hi'], { type: 'video/mp4' })], 'video/mp4;codecs=avc1', when);
	assert.ok(file);
	assert.equal(file.name, 'pokedex-20261123-0905.mp4');
	assert.equal(file.type, 'video/mp4');
	const webm = takeFromChunks([new Blob(['hi'])], 'video/webm;codecs=vp8', when);
	assert.equal(webm?.name, 'pokedex-20261123-0905.webm');

	let shared = false;
	assert.equal(await shareRecording(file, async () => {
		shared = true;
	}), 'shared');
	assert.equal(shared, true);

	assert.equal(
		await shareRecording(file, async () => {
			throw new DOMException('closed', 'AbortError');
		}),
		'abort'
	);
	assert.equal(
		await shareRecording(file, async () => {
			throw new DOMException('blocked', 'NotAllowedError');
		}),
		'button'
	);
	let called = false;
	assert.equal(
		await shareRecording(file, async () => {
			called = true;
		}, () => false),
		'button'
	);
	assert.equal(called, false);
	assert.equal(
		await shareRecording(file, () => {
			throw new Error('gesture gone');
		}),
		'button'
	);
});

test('a denied camera or microphone explains how to allow it', () => {
	assert.match(cameraErrorMessage('NotAllowedError'), /Allow the camera/);
	assert.match(cameraErrorMessage('NotFoundError'), /No front camera/);
	assert.match(cameraErrorMessage('AbortError'), /could not start/);
	assert.match(micErrorMessage('SecurityError'), /Allow the microphone/);
	assert.match(micErrorMessage('NotFoundError'), /No microphone/);
});

test('the recording clock stays compact', () => {
	assert.equal(formatClock(0), '0:00');
	assert.equal(formatClock(9400), '0:09');
	assert.equal(formatClock(65000), '1:05');
});

test('the teleprompter scrolls on a frame loop and does not upload the take', () => {
	const source = fs.readFileSync('src/lib/components/Teleprompter.svelte', 'utf8');
	assert.match(source, /requestAnimationFrame/);
	assert.match(source, /facingMode:\s*'user'/);
	assert.match(source, /navigator\.share/);
	assert.match(source, /wakeLock/);
	assert.match(source, /Save to Photos/);
	assert.match(source, /Tap Save Video to put it in Photos/);
	assert.match(source, /rec\.start\(500\)/);
	assert.doesNotMatch(source, /fetch\(/);
	const finish = source.slice(source.indexOf('function finishTake'), source.indexOf('function stopRecorder'));
	assert.match(finish, /requestData\(\)/);
	assert.match(finish, /active\.stop\(\)/);
	assert.match(finish, /offerShare\(file, true\)/);
	assert.doesNotMatch(finish, /await/);
	const stopped = source.slice(source.indexOf('rec.onstop'), source.indexOf('rec.start(500)'));
	assert.match(stopped, /offerShare\(file, false\)/);
	assert.doesNotMatch(stopped, /navigator\.share|shareRecording/);
	const detail = fs.readFileSync('src/lib/components/TaskDetail.svelte', 'utf8');
	assert.match(detail, /class="back-btn"/);
	assert.doesNotMatch(detail, /class="icon-btn"/);
	const hooks = fs.readFileSync('src/hooks.server.ts', 'utf8');
	assert.match(hooks, /camera=\(self\)/);
	assert.match(hooks, /microphone=\(self\)/);
	assert.match(hooks, /geolocation=\(\)/);
	const html = fs.readFileSync('src/app.html', 'utf8');
	assert.equal((html.match(/id="boot"/g) ?? []).length, 1);
	assert.match(html, /localStorage\.getItem\("pokedex-theme"\)/);
	assert.match(html, /root\.style\.background/);
	assert.match(html, /16vmin/);
	assert.match(html, /250ms/);
	assert.match(html, /prefers-color-scheme: dark/);
	assert.doesNotMatch(html, /boot-mark/);
	assert.doesNotMatch(html, /theme\.js/);
	assert.doesNotMatch(html, /apple-touch-startup-image/);
	assert.doesNotMatch(html, /startup-/);
	assert.equal(fs.existsSync('src/lib/components/Splash.svelte'), false);
	assert.equal(fs.existsSync('src/lib/brand/startup'), false);
	const manifest = fs.readFileSync('src/routes/manifest.webmanifest/+server.ts', 'utf8');
	assert.match(manifest, /background_color: '#FBF7F3'/);
	const inline = html.match(/<script>([\s\S]*?)<\/script>/);
	assert.ok(inline);
	const hash = crypto.createHash('sha256').update(inline[1]).digest('base64');
	assert.match(fs.readFileSync('svelte.config.js', 'utf8'), new RegExp(hash.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
});

test('a green push to main deploys, and a missing Coolify secret skips', () => {
	const workflow = fs.readFileSync('.github/workflows/deploy.yml', 'utf8');
	assert.match(workflow, /workflows: \[CI\]/);
	assert.match(workflow, /head_branch == 'main'/);
	assert.match(workflow, /secrets\.COOLIFY_DEPLOY_WEBHOOK/);
	assert.match(workflow, /secrets\.COOLIFY_TOKEN/);
	assert.match(workflow, /Authorization: Bearer/);
	assert.match(workflow, /::notice::/);
	const readme = fs.readFileSync('README.md', 'utf8');
	assert.match(readme, /COOLIFY_DEPLOY_WEBHOOK/);
	assert.match(readme, /COOLIFY_TOKEN/);
});
