export type ThemeChoice = 'light' | 'dark' | 'system';

export const THEME_COOKIE = 'pokedex-theme';
export const THEME_STORAGE = 'pokedex-theme';

export const THEME_COLORS = {
	light: '#FBF7F3',
	dark: '#1C1916'
} as const;

export function parseTheme(value: unknown): ThemeChoice {
	return value === 'light' || value === 'dark' || value === 'system' ? value : 'system';
}

export function resolvedTheme(choice: ThemeChoice, prefersDark: boolean): 'light' | 'dark' {
	if (choice === 'dark') return 'dark';
	if (choice === 'light') return 'light';
	return prefersDark ? 'dark' : 'light';
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
