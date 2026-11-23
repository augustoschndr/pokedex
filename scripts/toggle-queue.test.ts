import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createToggleQueue } from '../src/lib/toggle-queue.ts';

test('toggles run in order and settle once', async () => {
	const seen: string[] = [];
	let idle = 0;
	const enqueue = createToggleQueue({
		onFail: () => seen.push('fail'),
		onIdle: async () => {
			idle += 1;
		}
	});
	enqueue(async () => {
		seen.push('a');
		return true;
	});
	enqueue(async () => {
		seen.push('b');
		return true;
	});
	await new Promise((resolve) => setTimeout(resolve, 20));
	assert.deepEqual(seen, ['a', 'b']);
	assert.equal(idle, 1);
});

test('a failed toggle rolls back and drops the rest of the burst', async () => {
	const seen: string[] = [];
	let failed = 0;
	let idle = 0;
	const enqueue = createToggleQueue({
		onFail: () => {
			failed += 1;
		},
		onIdle: () => {
			idle += 1;
		}
	});
	enqueue(async () => {
		seen.push('a');
		return false;
	});
	enqueue(async () => {
		seen.push('b');
		return true;
	});
	await new Promise((resolve) => setTimeout(resolve, 20));
	assert.deepEqual(seen, ['a']);
	assert.equal(failed, 1);
	assert.equal(idle, 0);
	enqueue(async () => {
		seen.push('c');
		return true;
	});
	await new Promise((resolve) => setTimeout(resolve, 20));
	assert.deepEqual(seen, ['a', 'c']);
	assert.equal(idle, 1);
});
