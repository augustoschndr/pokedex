import assert from 'node:assert/strict';
import { test } from 'node:test';
import { frameStage, phaseLabel } from '../src/lib/frame.ts';
import { optionLabel } from '../src/lib/decisions.ts';
import { isSlipped } from '../src/lib/calendar.ts';

test('phase names map loosely onto FRAME stages', () => {
	assert.equal(frameStage('Foundations'), 'Foundation');
	assert.equal(frameStage('foundation work'), 'Foundation');
	assert.equal(frameStage('CONTENT'), 'Rarity');
	assert.equal(frameStage('The Funnel'), 'Solution');
	assert.equal(frameStage('Sales and Prospecting'), 'Action');
	assert.equal(frameStage('Prospecting'), 'Action');
	assert.equal(frameStage('Clients'), 'Engagement');
	assert.equal(frameStage('Growth'), 'Motion/Reputation');
	assert.equal(frameStage('Reputation'), 'Motion/Reputation');
	assert.equal(frameStage('Logbook launch'), null);
	assert.equal(frameStage(''), null);
	assert.equal(frameStage(null), null);
});

test('a phase title drops the name when a FRAME pill already says it', () => {
	assert.equal(phaseLabel('1. Foundations: decisions and owned ground'), '1. Decisions and owned ground');
	assert.equal(
		phaseLabel('Client operations and Folder 01 (real estate)'),
		'Client operations and Folder 01 (real estate)'
	);
	assert.equal(phaseLabel('Foundations'), 'Foundations');
	assert.equal(phaseLabel(''), '');
});

test('a decision choice has a stable option label', () => {
	assert.equal(optionLabel('approved'), 'Approve');
	assert.equal(optionLabel('rejected'), 'Reject');
	assert.equal(optionLabel('commented'), 'Comment');
	assert.equal(optionLabel('pending'), null);
});

test('a slide marks the item slipped, a matching day does not', () => {
	assert.equal(isSlipped('2026-11-23', '2026-11-24', '2026-11-23-origin'), true);
	assert.equal(isSlipped('2026-11-24', '2026-11-24', '2026-11-24-reel'), false);
	assert.equal(isSlipped(null, null, '2026-11-24-reel'), false);
	assert.equal(isSlipped(null, '2026-11-24', '2026-11-23-origin'), true);
});
