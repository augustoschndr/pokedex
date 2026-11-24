import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { test } from 'node:test';
import { clampSpeed } from '../src/lib/prompter.ts';

test('scroll speed stays inside the slider and remembers a blank value as the default', () => {
	assert.equal(clampSpeed(null), 48);
	assert.equal(clampSpeed('fast'), 48);
	assert.equal(clampSpeed(4), 16);
	assert.equal(clampSpeed(400), 120);
	assert.equal(clampSpeed(52.4), 52);
});

test('the teleprompter scrolls on a frame loop without a camera', () => {
	const source = fs.readFileSync('src/lib/components/Teleprompter.svelte', 'utf8');
	assert.match(source, /requestAnimationFrame/);
	assert.match(source, /wakeLock/);
	assert.match(source, /aria-label="Scroll speed"/);
	assert.match(source, /Smaller text/);
	assert.doesNotMatch(source, /getUserMedia|MediaRecorder|navigator\.share|facingMode|Save to Photos/);
	assert.doesNotMatch(source, /fetch\(/);
	const detail = fs.readFileSync('src/lib/components/TaskDetail.svelte', 'utf8');
	assert.match(detail, /class="back-btn"/);
	assert.doesNotMatch(detail, /class="icon-btn"/);
	const hooks = fs.readFileSync('src/hooks.server.ts', 'utf8');
	assert.match(hooks, /camera=\(\)/);
	assert.match(hooks, /microphone=\(\)/);
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
