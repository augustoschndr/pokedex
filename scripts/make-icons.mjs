import fs from 'node:fs';
import path from 'node:path';
import { Resvg } from '@resvg/resvg-js';

const dir = path.resolve('static/icons');
fs.mkdirSync(dir, { recursive: true });

function svg(size, pad) {
	const inner = size - pad * 2;
	const x = pad;
	const y = pad;
	return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="#FBF7F3"/>
  <g transform="translate(${x} ${y}) scale(${inner / 64})">
    <circle cx="48" cy="12" r="6" fill="#171513"/>
    <path d="M10 22h22l4 5h18v24H10z" fill="none" stroke="#171513" stroke-width="2.2" stroke-linejoin="round"/>
    <path d="M10 32h44" stroke="#171513" stroke-width="2.2"/>
    <path d="M16 40h16M16 46h10" stroke="#171513" stroke-width="2" stroke-linecap="round"/>
  </g>
</svg>`;
}

function write(name, size, pad) {
	const resvg = new Resvg(svg(size, pad), { fitTo: { mode: 'width', value: size } });
	fs.writeFileSync(path.join(dir, name), resvg.render().asPng());
}

write('icon-192.png', 192, 28);
write('icon-512.png', 512, 72);
write('apple-touch-icon.png', 180, 26);
write('icon-maskable-512.png', 512, 128);
console.log('icons written');
