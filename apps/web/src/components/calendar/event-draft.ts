import type { RouterInputs } from "@mine/api/routers/index";

import {
	addDays,
	type DisplayEvent,
	dayKey,
	formatClock,
	parseDayKey,
	startOfDay,
} from "@/lib/calendar-time";
import { formatTime } from "@/lib/day-grid";
import { combineDayAndTime } from "@/lib/time";

export type EventTiming = RouterInputs["calendar"]["createEvent"]["when"];

const MINUTE = 60_000;
const DAY = 86_400_000;
/** How long a new timed event lasts until the person changes it. */
export const NEW_EVENT_MINUTES = 60;
const LAST_MINUTE = 23 * 60 + 59;

export interface EventDraft {
	allDay: boolean;
	calendarId: string;
	description: string;
	/** The last day, inclusive, also for all-day events. */
	endDay: string;
	endTime: string;
	location: string;
	startDay: string;
	startTime: string;
	title: string;
}

/** Where a new event starts: the day, and the minute when picked on the grid. */
export interface EventSeed {
	allDay: boolean;
	calendarId: string;
	day: string;
	minutes?: number;
}

const shiftDay = (day: string, days: number) => {
	const date = parseDayKey(day);
	return date ? dayKey(addDays(date, days)) : day;
};

export function draftFromEvent(
	event: DisplayEvent | null,
	seed: EventSeed
): EventDraft {
	if (event) {
		const base = {
			calendarId: event.calendarId,
			description: event.description ?? "",
			location: event.location ?? "",
			title: event.title,
		};
		if (event.allDay) {
			return {
				...base,
				allDay: true,
				endDay: shiftDay(event.end, -1),
				endTime: formatTime(9 * 60 + NEW_EVENT_MINUTES),
				startDay: event.start,
				startTime: formatTime(9 * 60),
			};
		}
		const start = Date.parse(event.start);
		const end = Date.parse(event.end);
		return {
			...base,
			allDay: false,
			endDay: dayKey(new Date(end)),
			endTime: formatClock(end),
			startDay: dayKey(new Date(start)),
			startTime: formatClock(start),
		};
	}
	const minutes = seed.minutes ?? 9 * 60;
	return {
		allDay: seed.allDay,
		calendarId: seed.calendarId,
		description: "",
		endDay: seed.day,
		endTime: formatTime(Math.min(minutes + NEW_EVENT_MINUTES, LAST_MINUTE)),
		location: "",
		startDay: seed.day,
		startTime: formatTime(minutes),
		title: "",
	};
}

/**
 * A new start, with the end moved along so the event keeps its length, as
 * calendars do when the start changes.
 */
export function moveStart(
	draft: EventDraft,
	changes: { startDay?: string; startTime?: string }
): EventDraft {
	const next = { ...draft, ...changes };
	const before = parseDayKey(draft.startDay);
	const after = parseDayKey(next.startDay);
	if (!(before && after)) {
		return next;
	}
	if (draft.allDay) {
		const days = Math.round((after.getTime() - before.getTime()) / DAY);
		return { ...next, endDay: shiftDay(draft.endDay, days) };
	}
	const oldStart = combineDayAndTime(draft.startDay, draft.startTime);
	const oldEnd = combineDayAndTime(draft.endDay, draft.endTime);
	const newStart = combineDayAndTime(next.startDay, next.startTime);
	if (oldStart === null || oldEnd === null || newStart === null) {
		return next;
	}
	const end = new Date(newStart + Math.max(oldEnd - oldStart, 0));
	return { ...next, endDay: dayKey(end), endTime: formatClock(end.getTime()) };
}

export type EventFields =
	| {
			description: string | null;
			error?: undefined;
			location: string | null;
			title: string;
			when: EventTiming;
	  }
	| { error: string };

/** The fields `calendar.createEvent` and `updateEvent` take, or what is wrong. */
export function eventFields(draft: EventDraft, timeZone: string): EventFields {
	const title = draft.title.trim();
	if (!title) {
		return { error: "タイトルを入力してください" };
	}
	const rest = {
		description: draft.description.trim() ? draft.description : null,
		location: draft.location.trim() || null,
		title,
	};
	if (draft.allDay) {
		if (!(parseDayKey(draft.startDay) && parseDayKey(draft.endDay))) {
			return { error: "日付を入力してください" };
		}
		if (draft.endDay < draft.startDay) {
			return { error: "終了日を開始日より後にしてください" };
		}
		return {
			...rest,
			when: {
				allDay: true,
				end: shiftDay(draft.endDay, 1),
				start: draft.startDay,
			},
		};
	}
	const start = combineDayAndTime(draft.startDay, draft.startTime);
	const end = combineDayAndTime(draft.endDay, draft.endTime);
	if (start === null || end === null) {
		return { error: "日時を入力してください" };
	}
	if (end <= start) {
		return { error: "終了を開始より後にしてください" };
	}
	return {
		...rest,
		when: {
			allDay: false,
			end: new Date(end).toISOString(),
			start: new Date(start).toISOString(),
			timeZone,
		},
	};
}

/** A timed event moved to `minutes` into `day`, keeping its length. */
export function movedTo(
	event: DisplayEvent,
	day: Date,
	minutes: number,
	timeZone: string
): EventTiming {
	const length = Date.parse(event.end) - Date.parse(event.start);
	const start = startOfDay(day).getTime() + minutes * MINUTE;
	return {
		allDay: false,
		end: new Date(start + length).toISOString(),
		start: new Date(start).toISOString(),
		timeZone,
	};
}

/** The event moved by whole days, keeping its times. */
export function shiftedByDays(
	event: DisplayEvent,
	days: number,
	timeZone: string
): EventTiming {
	if (event.allDay) {
		return {
			allDay: true,
			end: shiftDay(event.end, days),
			start: shiftDay(event.start, days),
		};
	}
	const move = (value: string) => {
		const date = new Date(Date.parse(value));
		const moved = new Date(
			date.getFullYear(),
			date.getMonth(),
			date.getDate() + days,
			date.getHours(),
			date.getMinutes(),
			date.getSeconds()
		);
		return moved.toISOString();
	};
	return {
		allDay: false,
		end: move(event.end),
		start: move(event.start),
		timeZone,
	};
}

/** Days from one day key to another. */
export function daysBetween(from: string, to: string): number {
	const a = parseDayKey(from);
	const b = parseDayKey(to);
	return a && b ? Math.round((b.getTime() - a.getTime()) / DAY) : 0;
}
