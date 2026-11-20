import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';

const shapes = [
	'<rect x="20" y="24" width="88" height="82" rx="18"/>',
	'<circle cx="44" cy="48" r="14"/>',
	'<circle cx="44" cy="48" r="5.5"/>',
	'<circle cx="70" cy="39" r="3.3" stroke-width="2.6"/>',
	'<circle cx="81" cy="39" r="3.3" stroke-width="2.6"/>',
	'<circle cx="92" cy="39" r="3.3" stroke-width="2.6"/>',
	'<path d="M60 56 H78 V68 H106"/>'
];

test('the splash mark matches the icon source', () => {
	const svg = fs.readFileSync('static/icons/icon.svg', 'utf8');
	const dark = fs.readFileSync('static/icons/icon-dark.svg', 'utf8');
	const mark = fs.readFileSync('src/lib/components/Mark.svelte', 'utf8');
	for (const shape of shapes) {
		assert.ok(svg.includes(shape), shape);
		assert.ok(dark.includes(shape), shape);
		assert.ok(mark.includes(shape), shape);
	}
	assert.match(svg, /fill="#FBF7F3"/);
	assert.match(dark, /fill="#1C1916"/);
	assert.doesNotMatch(svg, /fill="none" width="128"/);
});
