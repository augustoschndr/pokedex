const CACHE = 'pokedex-v4';

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

	// Icons, the manifest, and the root touch-icon probes are network-first.
	// Installed phones were keeping the previous artwork from a cache-first
	// copy of the unversioned icon URL.
	const fresh =
		url.pathname.startsWith('/icons/') ||
		url.pathname === '/manifest.webmanifest' ||
		url.pathname === '/apple-touch-icon.png' ||
		url.pathname === '/apple-touch-icon-precomposed.png';

	if (fresh) {
		event.respondWith(
			fetch(event.request)
				.then((response) => {
					if (response.ok) {
						const copy = response.clone();
						caches.open(CACHE).then((cache) => cache.put(event.request, copy));
					}
					return response;
				})
				.catch(async () => {
					const cached = await caches.match(event.request);
					if (cached) return cached;
					return Response.error();
				})
		);
		return;
	}

	// Hashed build assets only. Page data and HTML stay network-first so a
	// to-do tick or a decision answer is not stuck behind a stale cache.
	const immutable = url.pathname.startsWith('/_app/immutable/');

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

function notificationFrom(event) {
	const notice = { title: 'Pokedex', body: 'A new brief is ready', url: '/today' };
	if (!event.data) return notice;
	try {
		const parsed = event.data.json();
		if (parsed && typeof parsed === 'object') {
			if (typeof parsed.title === 'string' && parsed.title.trim()) notice.title = parsed.title.trim().slice(0, 120);
			if (typeof parsed.body === 'string') notice.body = parsed.body.slice(0, 240);
			if (typeof parsed.url === 'string' && parsed.url.startsWith('/') && !parsed.url.startsWith('//')) {
				notice.url = parsed.url;
			}
		}
	} catch {
		try {
			const text = event.data.text();
			if (text) notice.body = text.slice(0, 180);
		} catch {
			/* keep the fallback and still show it */
		}
	}
	return notice;
}

self.addEventListener('push', (event) => {
	const notice = notificationFrom(event);
	// iOS revokes the subscription when a push arrives and this is not called.
	event.waitUntil(
		self.registration
			.showNotification(notice.title, {
				body: notice.body,
				icon: '/icons/icon-192-v4.png',
				data: { url: notice.url }
			})
			.catch(() =>
				self.registration.showNotification(notice.title, {
					body: notice.body,
					data: { url: notice.url }
				})
			)
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
