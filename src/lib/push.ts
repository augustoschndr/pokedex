import { isIos, isStandalone } from '$lib/install';

export { isStandalone };

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
		applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource
	});
	const response = await fetch('/api/v1/push/subscribe', {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(subscription)
	});
	if (!response.ok) return { ok: false, message: 'Could not save this device' };
	return { ok: true, message: 'Notifications are on' };
}
