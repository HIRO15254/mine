import { useMemo } from "react";

import { dayKey, parseDayKey, startOfWeek } from "@/lib/calendar-time";

import { useTodayDate } from "./use-today";

/** `?week=YYYY-MM-DD` for the screens that show one week; anything else is dropped. */
export function validateWeekSearch(search: Record<string, unknown>): {
	week?: string;
} {
	return typeof search.week === "string" && parseDayKey(search.week)
		? { week: search.week }
		: {};
}

/** The week a screen shows: the one in the URL, or the current one. */
export function useWeek(week: string | undefined) {
	const today = useTodayDate();
	const weekStart = useMemo(
		() => startOfWeek(parseDayKey(week) ?? today),
		[today, week]
	);
	return {
		isCurrentWeek: dayKey(weekStart) === dayKey(startOfWeek(today)),
		today,
		weekStart,
	};
}

/** The search for a week; the current week has none, so its URL stays clean. */
export function weekSearch(start: Date | null): { week?: string } {
	return start ? { week: dayKey(start) } : {};
}
