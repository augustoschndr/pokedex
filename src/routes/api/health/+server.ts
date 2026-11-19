import { APP_VERSION } from '$lib/version';
import { json } from '$lib/server/http';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = () => json({ ok: true, version: APP_VERSION });
