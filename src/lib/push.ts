import { isIos, isStandalone } from '$lib/install';

export { isStandalone };

const ENDPOINT_KEY = 'pokedex-push-endpoint';

export type PushDeviceState = 'on' | 'off' | 'denied' | 'unsupported' | 'needs-home' | 'error';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
	const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
	const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
	const raw = atob(base64);
	const output = new Uint8Array(raw.length);
	for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
	return output;
}

export async function enablePush(publicKey: string): Promise<{ ok: boolean; message: string }> {
	if (isIos() && !isStandalone()) {
		return {
			ok: false,
			message: 'Open Pokedex from the Home Screen icon. iPhone and iPad only allow notifications there.'
		};
	}
	if (!publicKey) return { ok: false, message: 'Notifications are not configured on this server' };
	if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
		return { ok: false, message: 'This browser cannot show notifications' };
	}
	const permission = await Notification.requestPermission();
	if (permission !== 'granted') return { ok: false, message: 'Notifications stay off' };
	const registration = await navigator.serviceWorker.ready;
	const subscription = await registration.pushManager.subscribe({
		userVisibleOnly: true,
		applicationServerKey: applicationServerKey(publicKey)
	});
	const saved = await postSubscription(subscription);
	if (!saved) return { ok: false, message: 'Could not save this device' };
	return { ok: true, message: 'Notifications are on' };
}

function applicationServerKey(publicKey: string): BufferSource {
	return urlBase64ToUint8Array(publicKey) as BufferSource;
}

async function postSubscription(subscription: PushSubscription): Promise<boolean> {
	const response = await fetch('/api/v1/push/subscribe', {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(subscription)
	});
	if (!response.ok) return false;
	try {
		localStorage.setItem(ENDPOINT_KEY, subscription.endpoint);
	} catch {
		/* private mode */
	}
	return true;
}

/**
 * Keep the server row aligned with this device. A service worker update can
 * rotate the endpoint, and a 404/410 prune deletes the row while the browser
 * still holds the old one, so every open re-posts the current subscription.
 */
export async function ensurePushSubscription(publicKey: string): Promise<PushDeviceState> {
	if (isIos() && !isStandalone()) return 'needs-home';
	if (!publicKey || !('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
		return 'unsupported';
	}
	if (Notification.permission === 'denied') return 'denied';
	if (Notification.permission !== 'granted') return 'off';
	try {
		const registration = await navigator.serviceWorker.ready;
		let subscription = await registration.pushManager.getSubscription();
		if (!subscription) {
			subscription = await registration.pushManager.subscribe({
				userVisibleOnly: true,
				applicationServerKey: applicationServerKey(publicKey)
			});
		}
		const saved = await postSubscription(subscription);
		return saved ? 'on' : 'error';
	} catch {
		return 'error';
	}
}
