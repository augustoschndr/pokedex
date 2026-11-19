const CACHE = 'pokedex-v2';

self.addEventListener('install', (event) => {
	event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
	event.waitUntil(
		(async () => {
			const keys = await caches.keys();
			await Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)));
			await self.clients.claim();
		})()
	);
});

self.addEventListener('fetch', (event) => {
	const url = new URL(event.request.url);
	if (url.origin !== self.location.origin) return;
	if (url.pathname.startsWith('/api/')) return;
	if (event.request.method !== 'GET') return;

	// Hashed build assets only. Page data and HTML stay network-first so a
	// to-do tick or a decision answer is not stuck behind a stale cache.
	const immutable =
		url.pathname.startsWith('/_app/immutable/') || url.pathname.startsWith('/icons/');

	if (!immutable || event.request.mode === 'navigate') {
		event.respondWith(
			fetch(event.request).catch(async () => {
				const cached = await caches.match(event.request);
				if (cached) return cached;
				return Response.error();
			})
		);
		return;
	}

	event.respondWith(
		caches.match(event.request).then((cached) => {
			if (cached) return cached;
			return fetch(event.request).then((response) => {
				if (response.ok) {
					const copy = response.clone();
					caches.open(CACHE).then((cache) => cache.put(event.request, copy));
				}
				return response;
			});
		})
	);
});

self.addEventListener('push', (event) => {
	let data = { title: 'Pokedex', body: 'A new brief is ready', url: '/today' };
	try {
		if (event.data) data = { ...data, ...event.data.json() };
	} catch {
		data.body = event.data ? event.data.text() : data.body;
	}
	event.waitUntil(
		self.registration.showNotification(data.title, {
			body: data.body,
			icon: '/icons/icon-192.png',
			badge: '/icons/icon-192.png',
			data: { url: data.url || '/today' }
		})
	);
});

self.addEventListener('notificationclick', (event) => {
	event.notification.close();
	const target = new URL(event.notification.data?.url || '/today', self.location.origin).href;
	event.waitUntil(
		(async () => {
			const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
			for (const client of windows) {
				if (client.url.startsWith(self.location.origin) && 'focus' in client) {
					await client.focus();
					if ('navigate' in client) return client.navigate(target);
					return client;
				}
			}
			return self.clients.openWindow(target);
		})()
	);
});
