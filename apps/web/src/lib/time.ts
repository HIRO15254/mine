import type { RouterOutputs } from "@mine/api/routers/index";

import {
	addDays,
	dayKey,
	parseDayKey,
	startOfDay,
	startOfWeek,
} from "./calendar-time";
import { formatDay } from "./tasks";

export type TimeEntry = RouterOutputs["time"]["list"][number];
export type TimeSummary = RouterOutputs["time"]["summary"];
export type ProjectRate = RouterOutputs["rate"]["list"][number];

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

const CLOCK = /^(\d{2}):(\d{2})$/;

const pad = (value: number) => String(value).padStart(2, "0");

/** Stopwatch style: 0:05:09, 12:00:00. */
export function formatElapsed(ms: number): string {
	const total = Math.max(0, Math.floor(ms / 1000));
	const hours = Math.floor(total / 3600);
	const minutes = Math.floor((total % 3600) / 60);
	return `${hours}:${pad(minutes)}:${pad(total % 60)}`;
}

/** Totals: 45分, 2時間, 2時間5分. Rounded down to the minute. */
export function formatDuration(ms: number): string {
	const minutes = Math.max(0, Math.floor(ms / MINUTE));
	const hours = Math.floor(minutes / 60);
	const rest = minutes % 60;
	if (hours === 0) {
		return `${rest}分`;
	}
	return rest === 0 ? `${hours}時間` : `${hours}時間${rest}分`;
}

/** Decimal hours for compact charts: 2.5h. */
export function formatHours(ms: number): string {
	const hours = ms / HOUR;
	return `${hours >= 10 ? Math.round(hours) : Math.round(hours * 10) / 10}h`;
}

const yen = new Intl.NumberFormat("ja-JP", {
	currency: "JPY",
	style: "currency",
});

export function formatYen(amount: number): string {
	return yen.format(amount);
}

/** Local instant for a YYYY-MM-DD day and an HH:MM time, or null. */
export function combineDayAndTime(day: string, time: string): number | null {
	const date = parseDayKey(day);
	const match = CLOCK.exec(time);
	if (!(date && match)) {
		return null;
	}
	const hours = Number(match[1]);
	const minutes = Number(match[2]);
	if (hours > 23 || minutes > 59) {
		return null;
	}
	date.setHours(hours, minutes, 0, 0);
	return date.getTime();
}

export function entryDuration(entry: TimeEntry, now: number): number {
	return Math.max(0, (entry.endedAt ?? now) - entry.startedAt);
}

export interface EntryDay {
	day: string;
	entries: TimeEntry[];
	title: string;
	totalMs: number;
}

/** Groups entries by the local day they started, newest day first. */
export function groupEntriesByDay(
	entries: TimeEntry[],
	now: number
): EntryDay[] {
	const today = dayKey(new Date(now));
	const days = new Map<string, TimeEntry[]>();
	for (const entry of entries) {
		const day = dayKey(new Date(entry.startedAt));
		days.set(day, [...(days.get(day) ?? []), entry]);
	}
	return [...days.entries()]
		.sort(([a], [b]) => b.localeCompare(a))
		.map(([day, items]) => ({
			day,
			entries: [...items].sort((a, b) => b.startedAt - a.startedAt),
			title: formatDay(day, today),
			totalMs: items.reduce((sum, entry) => sum + entryDuration(entry, now), 0),
		}));
}

/** Monday 00:00 to the next Monday, in local time. */
export function weekRange(date: Date): { from: number; to: number } {
	const start = startOfWeek(date);
	return { from: start.getTime(), to: addDays(start, 7).getTime() };
}

export function dayRange(date: Date): { from: number; to: number } {
	const start = startOfDay(date);
	return { from: start.getTime(), to: addDays(start, 1).getTime() };
}

export function currentTimeZone(): string {
	return Intl.DateTimeFormat().resolvedOptions().timeZone;
}
