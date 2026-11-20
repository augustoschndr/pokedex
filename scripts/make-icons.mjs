import fs from 'node:fs';
import path from 'node:path';
import { Resvg } from '@resvg/resvg-js';

const dir = path.resolve('static/icons');
fs.mkdirSync(dir, { recursive: true });

/** Shared with src/lib/components/Mark.svelte. Keep the geometry identical. */
export const markShapes = `
  <rect x="20" y="24" width="88" height="82" rx="18"/>
  <circle cx="44" cy="48" r="14"/>
  <circle cx="44" cy="48" r="5.5"/>
  <circle cx="70" cy="39" r="3.3" stroke-width="2.6"/>
  <circle cx="81" cy="39" r="3.3" stroke-width="2.6"/>
  <circle cx="92" cy="39" r="3.3" stroke-width="2.6"/>
  <path d="M60 56 H78 V68 H106"/>
`;

function svg({ bg, ink, scale = 1 }) {
	const mark =
		scale === 1
			? markShapes
			: `<g transform="translate(64 64) scale(${scale}) translate(-64 -64)">${markShapes}</g>`;
	return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">
  <rect width="128" height="128" fill="${bg}"/>
  <g fill="none" stroke="${ink}" stroke-width="4.75" stroke-linecap="round" stroke-linejoin="round">
    ${mark}
  </g>
</svg>`;
}

function render(name, size, { bg, ink, scale = 1 }) {
	const resvg = new Resvg(svg({ bg, ink, scale }), {
		fitTo: { mode: 'width', value: size },
		background: bg,
		shapeRendering: 2,
		textRendering: 1,
		imageRendering: 0
	});
	const rendered = resvg.render();
	const pixels = rendered.pixels;
	for (let i = 3; i < pixels.length; i += 4) {
		if (pixels[i] !== 255) {
			throw new Error(`${name} has a transparent pixel`);
		}
	}
	const png = rendered.asPng();
	fs.writeFileSync(path.join(dir, name), png);
}

const light = { bg: '#FBF7F3', ink: '#171513' };
const dark = { bg: '#1C1916', ink: '#F6F1EA' };

fs.writeFileSync(path.join(dir, 'icon.svg'), svg(light));
fs.writeFileSync(path.join(dir, 'icon-dark.svg'), svg(dark));

render('icon-192.png', 192, light);
render('icon-512.png', 512, light);
render('apple-touch-icon.png', 180, light);
render('icon-maskable-192.png', 192, { ...light, scale: 0.76 });
render('icon-maskable-512.png', 512, { ...light, scale: 0.76 });
render('favicon-32.png', 32, light);
render('favicon-32-dark.png', 32, dark);
render('apple-touch-icon-dark.png', 180, dark);

console.log('icons written');
