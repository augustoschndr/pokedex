import { versionedIcon } from '$lib/icons';

export type ThemeChoice = 'light' | 'dark' | 'system';

export const THEME_COOKIE = 'pokedex-theme';
export const THEME_STORAGE = 'pokedex-theme';

export const THEME_COLORS = {
	light: '#FBF7F3',
	dark: '#1C1916'
} as const;

export const THEME_INK = {
	light: '#171513',
	dark: '#F6F1EA'
} as const;

/** iPhone SE (2nd generation), portrait. No color-scheme query: iOS would ignore the app theme. */
export const SE_STARTUP_MEDIA =
	'(device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)';

export function parseTheme(value: unknown): ThemeChoice {
	return value === 'light' || value === 'dark' || value === 'system' ? value : 'system';
}

export function resolvedTheme(choice: ThemeChoice, prefersDark: boolean): 'light' | 'dark' {
	if (choice === 'dark') return 'dark';
	if (choice === 'light') return 'light';
	return prefersDark ? 'dark' : 'light';
}

/** A signed-in user's saved theme wins. Otherwise keep the cookie, including on the login page. */
export function themeForRequest(saved: ThemeChoice | null, cookie: unknown): ThemeChoice {
	if (saved) return saved;
	return parseTheme(cookie);
}

export function themePaint(choice: ThemeChoice): {
	background: string;
	ink: string;
	colorScheme: string;
	resolved: 'light' | 'dark';
} {
	if (choice === 'dark') {
		return {
			background: THEME_COLORS.dark,
			ink: THEME_INK.dark,
			colorScheme: 'dark',
			resolved: 'dark'
		};
	}
	if (choice === 'light') {
		return {
			background: THEME_COLORS.light,
			ink: THEME_INK.light,
			colorScheme: 'light',
			resolved: 'light'
		};
	}
	return {
		background: THEME_COLORS.light,
		ink: THEME_INK.light,
		colorScheme: 'light dark',
		resolved: 'light'
	};
}

/** One launch image, and only for an explicit light or dark choice. System leaves the phone's own screen. */
export function startupHref(choice: ThemeChoice): string | null {
	if (choice === 'light') return versionedIcon('startup-750x1334.png');
	if (choice === 'dark') return versionedIcon('startup-750x1334-dark.png');
	return null;
}

export function startupMarkup(choice: ThemeChoice): string {
	const href = startupHref(choice);
	if (!href) return '';
	return `<link rel="apple-touch-startup-image" href="${href}" media="${SE_STARTUP_MEDIA}" />`;
}

export function manifestColors(choice: ThemeChoice): { background_color: string; theme_color: string } {
	const background = choice === 'dark' ? THEME_COLORS.dark : THEME_COLORS.light;
	return { background_color: background, theme_color: background };
}

/** Apply a saved choice and mirror it into localStorage and a readable cookie. */
export function applyTheme(choice: ThemeChoice): void {
	const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
	const resolved = resolvedTheme(choice, prefersDark);
	const root = document.documentElement;
	root.dataset.theme = resolved;
	root.style.colorScheme = resolved;
	document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLORS[resolved]);
	document.querySelector('meta[name="color-scheme"]')?.setAttribute('content', resolved);
	try {
		localStorage.setItem(THEME_STORAGE, choice);
	} catch {
		/* private mode */
	}
	const secure = location.protocol === 'https:' ? '; Secure' : '';
	document.cookie = `${THEME_COOKIE}=${choice}; Path=/; Max-Age=31536000; SameSite=Lax${secure}`;
}
