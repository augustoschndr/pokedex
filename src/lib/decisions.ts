export const DECISION_CHOICES = [
	{ action: 'approved', label: 'Approve' },
	{ action: 'rejected', label: 'Reject' }
] as const;

export type DecisionAction = 'approved' | 'rejected' | 'commented';

/** The label stored beside `action` on the answers readback. */
export function optionLabel(action: string | null | undefined): string | null {
	if (action === 'approved') return 'Approve';
	if (action === 'rejected') return 'Reject';
	if (action === 'commented') return 'Comment';
	return null;
}
