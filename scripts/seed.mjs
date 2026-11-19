import fs from 'node:fs';

const origin = (process.env.ORIGIN || process.env.POKEDEX_URL || 'http://localhost:3000').replace(/\/$/, '');
const token = process.env.INGEST_TOKEN;
if (!token) {
	console.error('Set INGEST_TOKEN');
	process.exit(1);
}
const payload = fs.readFileSync(new URL('../docs/example-payload.json', import.meta.url));
const response = await fetch(`${origin}/api/v1/ingest`, {
	method: 'POST',
	headers: {
		authorization: `Bearer ${token}`,
		'content-type': 'application/json'
	},
	body: payload
});
const text = await response.text();
console.log(response.status, text);
if (!response.ok) process.exit(1);
