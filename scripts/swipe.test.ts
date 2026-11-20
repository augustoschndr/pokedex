import assert from 'node:assert/strict';
import { test } from 'node:test';
import { commitDirection, follow, neighbor } from '../src/lib/tabs.ts';

test('tabs move one step and stop at the ends', () => {
	assert.equal(neighbor('/today', 1), '/week');
	assert.equal(neighbor('/today', -1), null);
	assert.equal(neighbor('/decisions', 1), null);
	assert.equal(neighbor('/you', -1), '/week');
	assert.equal(neighbor('/settings', 1), null);
});

test('the page resists when there is no neighbor', () => {
	assert.ok(follow(200, 375, true, false) < 200);
	assert.ok(follow(-200, 375, false, true) > -200);
	assert.equal(follow(-400, 375, false, false), -375);
	assert.equal(follow(40, 375, false, false), 40);
});

test('a long drag or a flick changes tabs', () => {
	assert.equal(commitDirection(-120, 375, 0), 1);
	assert.equal(commitDirection(120, 375, 0), -1);
	assert.equal(commitDirection(-20, 375, -0.8), 1);
	assert.equal(commitDirection(12, 375, 0), 0);
});
