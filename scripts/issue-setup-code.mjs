/**
 * Break-glass: print a new one-time setup code and store only its scrypt hash.
 * Keep the hash format in sync with src/lib/server/crypto.ts
 * (scrypt N=16384 r=8 p=1 keylen=32, stored as scrypt:<saltHex>:<hashHex>).
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import Database from 'better-sqlite3';

const file = process.env.DATABASE_PATH || './data/pokedex.db';
if (!fs.existsSync(file)) {
	console.error(`No database at ${file}. Start Pokedex once, then run this again.`);
	process.exit(1);
}

const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const bytes = crypto.randomBytes(8);
let raw = '';
for (let i = 0; i < 8; i++) raw += alphabet[bytes[i] % alphabet.length];
const code = `${raw.slice(0, 4)}-${raw.slice(4)}`;
const salt = crypto.randomBytes(16);
const hash = crypto.scryptSync(code.replace(/-/g, ''), salt, 32, { N: 16384, r: 8, p: 1 });
const stored = `scrypt:${salt.toString('hex')}:${hash.toString('hex')}`;

const db = new Database(file);
db.pragma('foreign_keys = ON');
const user = db.prepare('SELECT id FROM user ORDER BY created_at ASC LIMIT 1').get();
if (!user) {
	console.error('No user row. Start Pokedex once, then run this again.');
	process.exit(1);
}
const now = new Date().toISOString();
const expires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
db.prepare('UPDATE setup_code SET used_at = ? WHERE user_id = ? AND used_at IS NULL').run(now, user.id);
db.prepare(
	'INSERT INTO setup_code (id, user_id, code_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?)'
).run(crypto.randomUUID(), user.id, stored, expires, now);
console.log(`POKEDEX_SETUP_CODE=${code}`);
