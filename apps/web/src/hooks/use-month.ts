import { useMemo } from "react";

import { monthKey, parseMonthKey, startOfMonth } from "@/lib/calendar-time";

import { useTodayDate } from "./use-today";

/** `?month=YYYY-MM` for the month view; anything else is dropped. */
export function validMonth(value: unknown): string | undefined {
	return typeof value === "string" && parseMonthKey(value) ? value : undefined;
}

/** The month a screen shows: the one in the URL, or the current one. */
export function useMonth(month: string | undefined) {
	const today = useTodayDate();
	const monthStart = useMemo(
		() => parseMonthKey(month) ?? startOfMonth(today),
		[today, month]
	);
	return {
		isCurrentMonth: monthKey(monthStart) === monthKey(today),
		monthStart,
		today,
	};
}
