import { signBody } from './crypto';
import { markAnswerNotified, type AnswerRecord } from './content';
import { webhookSecret, webhookUrl } from './env';

export function deliverAnswer(userId: string, answer: AnswerRecord): void {
	const url = webhookUrl();
	const secret = webhookSecret();
	if (!url || !secret) return;
	const body = JSON.stringify({
		id: answer.id,
		title: answer.title,
		action: answer.action,
		option: answer.option,
		comment: answer.comment,
		answered_at: answer.answered_at
	});
	const signature = `sha256=${signBody(body, secret)}`;
	void (async () => {
		const waits = [0, 500, 1500];
		for (const wait of waits) {
			if (wait) await new Promise((resolve) => setTimeout(resolve, wait));
			try {
				const response = await fetch(url, {
					method: 'POST',
					headers: {
						'content-type': 'application/json',
						'x-pokedex-signature': signature
					},
					body,
					signal: AbortSignal.timeout(4000)
				});
				if (response.ok) {
					markAnswerNotified(userId, answer.id);
					return;
				}
			} catch (error) {
				console.error('decision webhook failed', error instanceof Error ? error.message : 'error');
			}
		}
	})();
}
