/**
 * FRAME stage for a CEO Operating Plan phase. Matched in the app, not at ingest.
 * Names are loose: case, punctuation, and extra words do not matter.
 * An unknown phase has no stage.
 */
const FRAME_STAGES: { test: RegExp; stage: string }[] = [
	{ test: /\bfoundation/, stage: 'Foundation' },
	{ test: /\bcontent\b/, stage: 'Rarity' },
	{ test: /\bfunnel\b/, stage: 'Solution' },
	{ test: /\b(?:sales|prospect)/, stage: 'Action' },
	{ test: /\bclient/, stage: 'Engagement' },
	{ test: /\b(?:growth|motion|reputation)\b/, stage: 'Motion/Reputation' }
];

export function frameStage(phaseTitle: string | null | undefined): string | null {
	if (!phaseTitle) return null;
	const name = phaseTitle
		.toLowerCase()
		.replace(/[^a-z]+/g, ' ')
		.trim();
	if (!name) return null;
	for (const row of FRAME_STAGES) {
		if (row.test.test(name)) return row.stage;
	}
	return null;
}
