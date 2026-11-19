export function json(data: unknown, status = 200, extra?: HeadersInit): Response {
	const headers = new Headers(extra);
	headers.set('content-type', 'application/json; charset=utf-8');
	headers.set('cache-control', 'no-store');
	return new Response(JSON.stringify(data), { status, headers });
}

export function readBearer(request: Request): string | null {
	const header = request.headers.get('authorization') ?? '';
	const match = /^Bearer\s+(\S+)\s*$/i.exec(header);
	return match ? match[1] : null;
}

export function clientKey(address: string, bucket: string): string {
	return `${bucket}:${address}`;
}
