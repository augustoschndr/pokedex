import {
	calendarSpan,
	countdownPhrase,
	diffDays,
	eachDay,
	formatDayNum,
	formatLong,
	formatShort,
	isoDateInZone,
	relation,
	type DayRelation
} from '$lib/calendar';
import { chooseFocus } from '$lib/schedule';
import type { GuideStep } from '$lib/types';
import { timeZone } from './env';
import {
	currentPlan,
	currentStudy,
	currentToday,
	currentTodos,
	currentWeek,
	getTask,
	scheduledTodos,
	type TodayView,
	type WeekItemView
} from './content';

export type ShotPreview = WeekItemView;

export type HomeFocus = {
	kind: 'todo' | 'week';
	id: string;
	title: string;
	date: string;
	dateLabel: string;
	when: 'today' | 'next';
	summary: string | null;
	duration: string | null;
	meta: string | null;
	steps: GuideStep[];
	script: string | null;
	done: boolean;
	href: string;
};

export type TodayPage = {
	today: string;
	dateLabel: string;
	mode: 'empty' | 'lesson' | 'prep' | 'past';
	countdown: string | null;
	upcomingTitle: string | null;
	pastLabel: string | null;
	lesson: TodayView | null;
	focus: HomeFocus | null;
	shots: ShotPreview[];
	todos: { id: string; text: string; meta: string | null }[];
	todoCount: number;
	studyHeading: string | null;
	studyCount: number;
};

export type WeekDay = {
	date: string;
	label: string;
	relation: DayRelation;
	items: ShotPreview[];
};

export type WeekPage = {
	today: string;
	dateLabel: string;
	intro: string;
	days: WeekDay[];
	undated: ShotPreview[];
	plan: { done: number; total: number } | null;
};

function shots(userId: string): ShotPreview[] {
	return currentWeek(userId).items;
}

function homeFocus(userId: string, today: string): HomeFocus | null {
	const candidates = [
		...shots(userId).flatMap((item, index) =>
			item.date ? [{ kind: 'week' as const, id: item.id, date: item.date, done: item.done, order: index }] : []
		),
		...scheduledTodos(userId).map((item) => ({
			kind: 'todo' as const,
			id: item.id,
			date: item.date,
			done: item.done,
			order: item.order
		}))
	];
	const chosen = chooseFocus(candidates, today);
	if (!chosen) return null;
	const task = getTask(userId, chosen.kind, chosen.id);
	if (!task) return null;
	const script = task.guide?.script?.trim() || null;
	return {
		kind: chosen.kind,
		id: chosen.id,
		title: task.title,
		date: chosen.date,
		dateLabel: formatShort(chosen.date),
		when: chosen.when,
		summary: task.guide?.summary ?? task.detail,
		duration: task.guide?.duration ?? null,
		meta: task.meta,
		steps: (task.guide?.steps ?? []).slice(0, 4),
		script,
		done: task.done,
		href: chosen.kind === 'todo' ? `/you/${chosen.id}` : `/week/${chosen.id}`
	};
}

export function todayPage(userId: string, now = Date.now()): TodayPage {
	const today = isoDateInZone(now, timeZone());
	const brief = currentToday(userId);
	const briefDate = brief?.for_date && /^\d{4}-\d{2}-\d{2}$/.test(brief.for_date) ? brief.for_date : null;
	const daysUntil = briefDate ? diffDays(today, briefDate) : null;
	let mode: TodayPage['mode'] = 'empty';
	if (!brief) mode = 'empty';
	else if (daysUntil === null) mode = 'lesson';
	else if (daysUntil > 0) mode = 'prep';
	else if (daysUntil < 0) mode = 'past';
	else mode = 'lesson';

	const open = currentTodos(userId).items.filter((item) => !item.done);
	const study = currentStudy(userId).study.blocks;
	const upcoming = shots(userId)
		.filter((item) => item.date && item.date >= today)
		.slice(0, 3);

	return {
		today,
		dateLabel: formatLong(today),
		mode,
		countdown: mode === 'prep' && briefDate ? countdownPhrase(today, briefDate) : null,
		upcomingTitle: mode === 'prep' ? brief?.lesson ?? null : null,
		pastLabel: mode === 'past' && briefDate ? formatShort(briefDate) : null,
		lesson: mode === 'lesson' ? brief : null,
		focus: homeFocus(userId, today),
		shots: upcoming,
		todos: open.slice(0, 3).map((item) => ({ id: item.id, text: item.text, meta: item.meta })),
		todoCount: open.length,
		studyHeading: study[0]?.heading ?? null,
		studyCount: study.length
	};
}

export function weekPage(userId: string, now = Date.now()): WeekPage {
	const today = isoDateInZone(now, timeZone());
	const week = currentWeek(userId);
	const items = shots(userId);
	const span = calendarSpan(
		today,
		items.flatMap((item) => (item.date ? [item.date] : []))
	);
	const plan = currentPlan(userId);
	return {
		today,
		dateLabel: formatLong(today),
		intro: week.intro,
		days: eachDay(span.start, span.end).map((date) => ({
			date,
			label: formatDayNum(date),
			relation: relation(date, today),
			items: items.filter((item) => item.date === date)
		})),
		undated: items.filter((item) => !item.date),
		plan: plan ? { done: plan.done, total: plan.total } : null
	};
}
