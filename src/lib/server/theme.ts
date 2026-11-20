import { db } from './db';
import { nowIso } from './time';
import { parseTheme, type ThemeChoice } from '$lib/theme';

export function userTheme(userId: string): ThemeChoice {
	const row = db().prepare('SELECT theme FROM user WHERE id = ?').get(userId) as
		| { theme?: string }
		| undefined;
	return parseTheme(row?.theme);
}

export function setUserTheme(userId: string, theme: ThemeChoice): void {
	db().prepare('UPDATE user SET theme = ?, updated_at = ? WHERE id = ?').run(theme, nowIso(), userId);
}
