export type InstallSurface = 'standalone' | 'ios-safari' | 'ios-browser' | 'ios-inapp' | 'installable';

export interface InstallClient {
	surface: InstallSurface;
	ios: boolean;
	ipad: boolean;
	standalone: boolean;
	browserName: string | null;
}

export interface InstallSignals {
	ua: string;
	platform: string;
	maxTouchPoints: number;
	standalone: boolean;
}

export interface GuideStep {
	title: string;
	body: string;
	shareIcon?: boolean;
}

export interface HomeScreenCopy {
	kicker: string;
	title: string;
	lede: string;
	steps: GuideStep[];
}

export interface BeforeInstallPromptEvent extends Event {
	readonly platforms: string[];
	readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
	prompt(): Promise<void>;
}

const IOS_BROWSERS: { name: string; re: RegExp }[] = [
	{ name: 'Chrome', re: /CriOS/ },
	{ name: 'Firefox', re: /FxiOS/ },
	{ name: 'Edge', re: /EdgiOS/ },
	{ name: 'Opera', re: /OPiOS|OPT\// },
	{ name: 'DuckDuckGo', re: /DuckDuckGo/ },
	{ name: 'Brave', re: /Brave/ },
	{ name: 'Yandex', re: /YaBrowser/ },
	{ name: 'UC Browser', re: /UCBrowser/ },
	{ name: 'Firefox Focus', re: /Focus/ }
];

const IN_APP: { name: string; re: RegExp }[] = [
	{ name: 'Instagram', re: /Instagram/ },
	{ name: 'Facebook', re: /FBAN|FBAV|FB_IAB/ },
	{ name: 'Messenger', re: /Messenger/ },
	{ name: 'X', re: /Twitter/ },
	{ name: 'LinkedIn', re: /LinkedInApp/ },
	{ name: 'Snapchat', re: /Snapchat/ },
	{ name: 'TikTok', re: /TikTok|musical_ly/ },
	{ name: 'Pinterest', re: /Pinterest/ },
	{ name: 'Line', re: /\bLine\// },
	{ name: 'WeChat', re: /MicroMessenger/ },
	{ name: 'Google app', re: /GSA\// }
];

export function isStandalone(): boolean {
	if (typeof window === 'undefined') return false;
	const nav = navigator as Navigator & { standalone?: boolean };
	if (nav.standalone === true) return true;
	const mode = window.matchMedia('(display-mode: standalone)').matches;
	const overlay = window.matchMedia('(display-mode: window-controls-overlay)').matches;
	return mode || overlay;
}

export function classifyInstall(signals: InstallSignals): InstallClient {
	const ua = signals.ua;
	const iphone = /iPhone|iPod/.test(ua);
	const ipadFromUa = /iPad/.test(ua);
	const ipadFromMac = !iphone && !ipadFromUa && signals.platform === 'MacIntel' && signals.maxTouchPoints > 1;
	const ipad = ipadFromUa || ipadFromMac;
	const ios = iphone || ipad;

	if (signals.standalone) {
		return { surface: 'standalone', ios, ipad, standalone: true, browserName: null };
	}
	if (!ios) {
		return { surface: 'installable', ios: false, ipad: false, standalone: false, browserName: null };
	}

	const inApp = IN_APP.find((entry) => entry.re.test(ua));
	if (inApp) {
		return { surface: 'ios-inapp', ios: true, ipad, standalone: false, browserName: inApp.name };
	}
	const browser = IOS_BROWSERS.find((entry) => entry.re.test(ua));
	if (browser) {
		return { surface: 'ios-browser', ios: true, ipad, standalone: false, browserName: browser.name };
	}
	const safari = /Safari/.test(ua) && /Version\/[\d.]+/.test(ua);
	if (safari) {
		return { surface: 'ios-safari', ios: true, ipad, standalone: false, browserName: 'Safari' };
	}
	return { surface: 'ios-inapp', ios: true, ipad, standalone: false, browserName: null };
}

export function detectInstallClient(): InstallClient {
	return classifyInstall({
		ua: navigator.userAgent,
		platform: navigator.platform,
		maxTouchPoints: navigator.maxTouchPoints ?? 0,
		standalone: isStandalone()
	});
}

export function isIos(): boolean {
	return detectInstallClient().ios;
}

function shareWhere(ipad: boolean): string {
	return ipad ? 'in the toolbar at the top' : 'in the bottom toolbar';
}

function deviceWord(ipad: boolean): string {
	return ipad ? 'iPad' : 'iPhone';
}

export function homeScreenCopy(client: InstallClient): HomeScreenCopy | null {
	if (!client.ios || client.standalone) return null;
	const where = shareWhere(client.ipad);
	const device = deviceWord(client.ipad);

	if (client.surface === 'ios-browser') {
		const name = client.browserName ?? 'This browser';
		return {
			kicker: `${name} on ${device}`,
			title: 'Add to Home Screen',
			lede: `${name} cannot install this page. Use its share menu, or open the link in Safari.`,
			steps: [
				{
					title: `Tap Share in ${name}`,
					body: 'The square with an up arrow. Or open the menu and choose Open in Safari.',
					shareIcon: true
				},
				{
					title: 'Tap Add to Home Screen',
					body: 'If it is missing, open this page in Safari and tap Share there. Still missing? Tap Edit Actions at the bottom and add it.'
				},
				{
					title: 'Tap Add',
					body: 'Then open Pokedex from the new Home Screen icon.'
				}
			]
		};
	}

	if (client.surface === 'ios-inapp') {
		const whereFrom = client.browserName ? `${client.browserName}'s menu` : "this app's menu";
		return {
			kicker: client.browserName ? `In ${client.browserName}` : 'Inside another app',
			title: 'Open in Safari',
			lede: 'This view cannot add a Home Screen icon. Safari can.',
			steps: [
				{
					title: 'Open in Safari',
					body: `Use ${whereFrom} and choose Open in Safari, or copy the link and paste it into Safari.`
				},
				{
					title: 'Tap Share',
					body: `The square with an up arrow, ${where} of Safari.`,
					shareIcon: true
				},
				{
					title: 'Tap Add to Home Screen',
					body: 'Then tap Add. If it is missing, tap Edit Actions at the bottom and add it. Open Pokedex from the new icon.'
				}
			]
		};
	}

	return {
		kicker: `On ${device}`,
		title: 'Add to Home Screen',
		lede: 'Safari cannot add this page for you.',
		steps: [
			{
				title: 'Tap Share',
				body: `The square with an up arrow, ${where}.`,
				shareIcon: true
			},
			{
				title: 'Tap Add to Home Screen',
				body: 'Scroll the list. If it is missing, tap Edit Actions at the bottom and add it.'
			},
			{
				title: 'Tap Add',
				body: 'Then open Pokedex from the new Home Screen icon.'
			}
		]
	};
}

export function notificationCopy(client: InstallClient): string {
	if (client.ios && client.standalone) {
		return 'A short push when a brief arrives. iPhone and iPad only allow this from the Home Screen app, which is this one.';
	}
	if (client.ios) {
		return 'iPhone and iPad only allow notifications from the Home Screen app. Open Pokedex from that icon first.';
	}
	return 'A short push when a brief arrives.';
}

export function listenForInstallPrompt(onPrompt: (event: BeforeInstallPromptEvent) => void): () => void {
	const onBefore = (event: Event) => {
		event.preventDefault();
		onPrompt(event as BeforeInstallPromptEvent);
	};
	window.addEventListener('beforeinstallprompt', onBefore);
	return () => window.removeEventListener('beforeinstallprompt', onBefore);
}

export async function runInstallPrompt(
	event: BeforeInstallPromptEvent
): Promise<'accepted' | 'dismissed'> {
	await event.prompt();
	const choice = await event.userChoice;
	return choice.outcome;
}
