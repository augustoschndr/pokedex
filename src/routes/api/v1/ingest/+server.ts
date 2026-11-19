import { applyIngest, allow, markPushed, principalForToken } from '$lib/server/db';
import { clientKey, json, readBearer } from '$lib/server/http';
import { pushTarget, pushToUser } from '$lib/server/push';
import { ingestSchema } from '$lib/server/schema';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, getClientAddress }) => {
	let address = 'unknown';
	try {
		address = getClientAddress();
	} catch {
		address = 'unknown';
	}
	if (!allow(clientKey(address, 'ingest'))) {
		return json({ ok: false, error: 'rate_limited' }, 429);
	}
	const token = readBearer(request);
	const principal = token ? principalForToken(token) : null;
	if (!principal?.scopes.includes('ingest:write')) {
		return json({ ok: false, error: 'unauthorized' }, 401);
	}
	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return json({ ok: false, error: 'invalid_json' }, 400);
	}
	const parsed = ingestSchema.safeParse(body);
	if (!parsed.success) {
		return json(
			{
				ok: false,
				error: 'invalid_payload',
				issues: parsed.error.issues.map((issue) => ({
					path: issue.path.join('.'),
					message: issue.message
				}))
			},
			400
		);
	}
	const briefId = applyIngest(principal.id, parsed.data);
	const pushed = await pushToUser(principal.id, pushTarget(parsed.data));
	markPushed(principal.id, briefId);
	console.log(`ingest brief=${briefId} type=${parsed.data.type} pushed=${pushed}`);
	return json({ ok: true, brief_id: briefId, pushed });
};
