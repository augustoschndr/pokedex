import {
	countdownPhrase,
	diffDays,
	endOfWeek,
	formatDayNum,
	formatLong,
	formatShort,
	isoDateInZone,
	startOfWeek
} from '$lib/calendar';
import { chooseFocus } from '$lib/schedule';
import type { GuideStep } from '$lib/types';
import {
	currentDecisions,
	currentPlan,
	currentStudy,
	currentToday,
	currentTodos,
	currentWeek,
	listBriefs,
	pendingDecisionCount,
	scheduledItems,
	type DecisionView,
	type ScheduledItem
} from './content';
import { timeZone } from './env';

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
	phase: string | null;
	frame: string | null;
	slipped: boolean;
	movedFrom: string | null;
	href: string;
};

export type DayItem = {
	kind: 'todo' | 'week';
	id: string;
	title: string;
	dateLabel: string;
	done: boolean;
	phase: string | null;
	frame: string | null;
	slipped: boolean;
	movedFrom: string | null;
	href: string;
};

export type TodayPage = {
	today: string;
	dateLabel: string;
	mode: 'empty' | 'lesson' | 'prep' | 'past';
	countdown: string | null;
	upcomingTitle: string | null;
	pastLabel: string | null;
	lesson: string | null;
	focus: HomeFocus | null;
	also: DayItem[];
	decisions: DecisionView[];
};

export type WeekPage = {
	today: string;
	dateLabel: string;
	intro: string;
	items: DayItem[];
	done: number;
	total: number;
};

export type MorePage = {
	openTodos: number;
	studyCount: number;
	briefCount: number;
	pending: number;
};

function hrefFor(kind: 'todo' | 'week', id: string): string {
	return kind === 'todo' ? `/you/${id}` : `/week/${id}`;
}

function asFocus(item: ScheduledItem & { when: 'today' | 'next' }): HomeFocus {
	return {
		kind: item.kind,
		id: item.id,
		title: item.title,
		date: item.date,
		dateLabel: formatShort(item.date),
		when: item.when,
		summary: item.summary,
		duration: item.duration,
		meta: item.meta,
		steps: item.steps.slice(0, 4),
		script: item.script,
		done: item.done,
		phase: item.phase,
		frame: item.frame,
		slipped: item.slipped,
		movedFrom: item.movedFrom ? formatDayNum(item.movedFrom) : null,
		href: hrefFor(item.kind, item.id)
	};
}

function asDay(item: ScheduledItem): DayItem {
	return {
		kind: item.kind,
		id: item.id,
		title: item.title,
		dateLabel: formatDayNum(item.date),
		done: item.done,
		phase: item.phase,
		frame: item.frame,
		slipped: item.slipped,
		movedFrom: item.movedFrom ? formatDayNum(item.movedFrom) : null,
		href: hrefFor(item.kind, item.id)
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

	const items = scheduledItems(userId);
	const chosen = chooseFocus(items, today);
	const focus = chosen ? asFocus(chosen) : null;
	const also = items
		.filter((item) => item.date === today && !(focus && item.kind === focus.kind && item.id === focus.id))
		.slice(0, 2)
		.map(asDay);

	return {
		today,
		dateLabel: formatLong(today),
		mode,
		countdown: mode === 'prep' && briefDate ? countdownPhrase(today, briefDate) : null,
		upcomingTitle: mode === 'prep' ? (brief?.lesson ?? null) : null,
		pastLabel: mode === 'past' && briefDate ? formatShort(briefDate) : null,
		lesson: mode === 'lesson' ? (brief?.lesson ?? null) : null,
		focus,
		also,
		decisions: currentDecisions(userId).filter((item) => item.status === 'pending')
	};
}

export function weekPage(userId: string, now = Date.now()): WeekPage {
	const today = isoDateInZone(now, timeZone());
	const start = startOfWeek(today);
	const end = endOfWeek(today);
	const items = scheduledItems(userId)
		.filter((item) => item.date >= start && item.date <= end)
		.sort((a, b) => a.date.localeCompare(b.date) || a.order - b.order || a.id.localeCompare(b.id))
		.map(asDay);
	return {
		today,
		dateLabel: formatLong(today),
		intro: currentWeek(userId).intro,
		items,
		done: items.filter((item) => item.done).length,
		total: items.length
	};
}

export function morePage(userId: string): MorePage {
	const study = currentStudy(userId);
	return {
		openTodos: currentTodos(userId).items.filter((item) => !item.done).length,
		studyCount: study.study.blocks.length + study.reels_rules.blocks.length,
		briefCount: listBriefs(userId).length,
		pending: pendingDecisionCount(userId)
	};
}

export function planPage(userId: string) {
	return currentPlan(userId);
}
