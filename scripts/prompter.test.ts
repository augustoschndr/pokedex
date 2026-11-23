import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';
import {
	cameraErrorMessage,
	clampSpeed,
	formatClock,
	micErrorMessage,
	pickRecorderMime,
	recordingExtension
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
		'video/mp4;codecs=avc1.42E01E,mp4a.40.2'
	);
	assert.equal(pickRecorderMime((type) => type === 'video/webm'), 'video/webm');
	assert.equal(pickRecorderMime(() => false), '');
	assert.equal(recordingExtension('video/webm;codecs=vp8,opus'), 'webm');
	assert.equal(recordingExtension('video/mp4'), 'mp4');
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
	assert.doesNotMatch(source, /fetch\(/);
	const detail = fs.readFileSync('src/lib/components/TaskDetail.svelte', 'utf8');
	assert.match(detail, /class="back-btn"/);
	assert.doesNotMatch(detail, /class="icon-btn"/);
	const hooks = fs.readFileSync('src/hooks.server.ts', 'utf8');
	assert.match(hooks, /camera=\(self\)/);
	assert.match(hooks, /microphone=\(self\)/);
	assert.match(hooks, /geolocation=\(\)/);
	const html = fs.readFileSync('src/app.html', 'utf8');
	assert.match(html, /id="boot"/);
	assert.match(html, /startup-750x1334-v4\.png/);
	assert.match(html, /device-width: 375px\) and \(device-height: 667px\)/);
	assert.match(html, /prefers-color-scheme: dark/);
	const png = fs.readFileSync('src/lib/brand/startup/startup-750x1334.png');
	assert.equal(png.readUInt32BE(16), 750);
	assert.equal(png.readUInt32BE(20), 1334);
});
