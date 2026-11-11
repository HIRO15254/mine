import { useMemo, useSyncExternalStore } from "react";

import { parseDayKey, startOfDay } from "@/lib/calendar-time";
import { todayKey } from "@/lib/tasks";

/** How often an open screen checks whether the day has changed. */
const CHECK_EVERY = 60_000;

function subscribe(onChange: () => void) {
	const timer = window.setInterval(onChange, CHECK_EVERY);
	// A sleeping tab runs no timers; look again as soon as it is back.
	document.addEventListener("visibilitychange", onChange);
	window.addEventListener("focus", onChange);
	return () => {
		window.clearInterval(timer);
		document.removeEventListener("visibilitychange", onChange);
		window.removeEventListener("focus", onChange);
	};
}

const snapshot = () => todayKey();

/**
 * Today as YYYY-MM-DD in local time. It changes when the day does, so a
 * screen left open overnight does not go on showing yesterday as today.
 */
export function useToday(): string {
	return useSyncExternalStore(subscribe, snapshot, snapshot);
}

/** The start of today in local time, a new Date only when the day changes. */
export function useTodayDate(): Date {
	const today = useToday();
	return useMemo(() => parseDayKey(today) ?? startOfDay(new Date()), [today]);
}
