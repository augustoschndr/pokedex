import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ingestSchema } from '../src/lib/server/schema.ts';

const base = { id: 'brief-1', type: 'ad_hoc' as const };

test('a guide and a plan ingest', () => {
	const parsed = ingestSchema.safeParse({
		...base,
		plan: {
			phases: [
				{
					id: 'phase-1',
					title: 'Launch',
					order: 1,
					milestones: [{ id: 'ms-1', title: 'Film' }]
				}
			]
		},
		todos: {
			items: [
				{
					id: 'task-1',
					text: 'Film it',
					guide: {
						summary: 'One take',
						duration: '20 min',
						script: 'Hello.',
						plan_ref: 'ms-1',
						checklist: [{ id: 'mic', text: 'Mic on' }],
						links: [{ label: 'Notes', url: 'https://example.com/notes' }]
					}
				}
			]
		}
	});
	assert.equal(parsed.success, true);
});

test('a javascript url is rejected', () => {
	const parsed = ingestSchema.safeParse({
		...base,
		todos: {
			items: [
				{
					id: 'task-1',
					text: 'Film it',
					guide: { links: [{ label: 'bad', url: 'javascript:alert(1)' }] }
				}
			]
		}
	});
	assert.equal(parsed.success, false);
});

test('a repeated plan id is rejected', () => {
	const parsed = ingestSchema.safeParse({
		...base,
		plan: {
			phases: [
				{
					id: 'same',
					title: 'A',
					order: 1,
					milestones: [{ id: 'same', title: 'B' }]
				}
			]
		}
	});
	assert.equal(parsed.success, false);
	if (!parsed.success) {
		assert.ok(parsed.error.issues.some((issue) => issue.message.includes('unique')));
	}
});

test('omitting the guide is still valid', () => {
	const parsed = ingestSchema.safeParse({
		...base,
		week: { items: [{ id: 'shot-1', title: 'Shoot' }] },
		todos: { items: [{ id: 'task-1', text: 'Do it', done: true }] }
	});
	assert.equal(parsed.success, true);
});
