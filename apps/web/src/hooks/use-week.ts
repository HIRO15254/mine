import { useMemo } from "react";

import { dayKey, parseDayKey, startOfWeek } from "@/lib/calendar-time";

import { useTodayDate } from "./use-today";

/**
 * `?week=YYYY-MM-DD` for the screens that show one week; anything else is
 * dropped. The key is always answered: the router lays the result over the
 * raw search, so leaving it out would keep the unchecked value.
 */
export function validateWeekSearch(search: Record<string, unknown>): {
	week?: string;
} {
	return {
		week:
			typeof search.week === "string" && parseDayKey(search.week)
				? search.week
				: undefined,
	};
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
