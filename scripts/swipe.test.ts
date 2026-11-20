import assert from 'node:assert/strict';
import { test } from 'node:test';
import { aimedVelocity, commitDirection, follow, neighbor, stepSpring, tabRoot } from '../src/lib/tabs.ts';

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

test('detail routes stay on the tab that owns them', () => {
	assert.equal(tabRoot('/you/cf-cal'), '/you');
	assert.equal(tabRoot('/week/plan'), '/week');
	assert.equal(tabRoot('/settings'), null);
});

test('the spring lands on the target and keeps speed aimed at it', () => {
	assert.equal(aimedVelocity(-40, -375, -0.8), -800);
	assert.equal(aimedVelocity(-40, -375, 0.4), 0);
	let offset = -40;
	let velocity = -800;
	for (let i = 0; i < 90 && Math.abs(offset + 375) > 0.5; i++) {
		const step = stepSpring(offset, -375, velocity, 1 / 60);
		offset = step.offset;
		velocity = step.velocity;
		if (step.settled) break;
	}
	assert.ok(Math.abs(offset + 375) < 1);
});
