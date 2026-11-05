/** Date helpers for the calendar views. All of them work in the browser's time zone. */

export interface TimedRange {
	timeMax: string;
	timeMin: string;
}

export interface DisplayEvent {
	allDay: boolean;
	calendarId: string;
	color: string;
	end: string;
	htmlLink: string | null;
	id: string;
	location: string | null;
	start: string;
	title: string;
}

const DAY_KEY = /^(\d{4})-(\d{2})-(\d{2})$/;

export function startOfDay(date: Date): Date {
	return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function addDays(date: Date, days: number): Date {
	return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

/** Monday of the week that contains `date`. */
export function startOfWeek(date: Date): Date {
	const day = startOfDay(date);
	return addDays(day, -((day.getDay() + 6) % 7));
}

export function dayKey(date: Date): string {
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${date.getFullYear()}-${month}-${day}`;
}

export function parseDayKey(value: string | undefined): Date | null {
	const match = value ? DAY_KEY.exec(value) : null;
	if (!match) {
		return null;
	}
	const date = new Date(
		Number(match[1]),
		Number(match[2]) - 1,
		Number(match[3])
	);
	return dayKey(date) === value ? date : null;
}

export function rangeOfDays(start: Date, days: number): TimedRange {
	return {
		timeMin: startOfDay(start).toISOString(),
		timeMax: addDays(start, days).toISOString(),
	};
}

function eventBounds(event: DisplayEvent): { end: number; start: number } {
	if (event.allDay) {
		return {
			start: parseDayKey(event.start)?.getTime() ?? Number.NaN,
			end: parseDayKey(event.end)?.getTime() ?? Number.NaN,
		};
	}
	return { start: Date.parse(event.start), end: Date.parse(event.end) };
}

/** Events that overlap the local day, all-day ones first, then by start time. */
export function eventsOnDay(events: DisplayEvent[], day: Date): DisplayEvent[] {
	const dayStart = startOfDay(day).getTime();
	const dayEnd = addDays(day, 1).getTime();
	return events
		.filter((event) => {
			const { start, end } = eventBounds(event);
			return start < dayEnd && Math.max(end, start + 1) > dayStart;
		})
		.sort((a, b) => {
			if (a.allDay !== b.allDay) {
				return a.allDay ? -1 : 1;
			}
			return (
				eventBounds(a).start - eventBounds(b).start ||
				a.title.localeCompare(b.title, "ja")
			);
		});
}

const timeFormat = new Intl.DateTimeFormat("ja-JP", {
	hour: "2-digit",
	minute: "2-digit",
});

/** "10:00–11:00", or "終日"; parts outside the day become "〜". */
export function formatEventTime(event: DisplayEvent, day: Date): string {
	if (event.allDay) {
		return "終日";
	}
	const dayStart = startOfDay(day).getTime();
	const dayEnd = addDays(day, 1).getTime();
	const start = Date.parse(event.start);
	const end = Date.parse(event.end);
	const from = start < dayStart ? "" : timeFormat.format(start);
	const to = end > dayEnd ? "" : timeFormat.format(end);
	if (!(from || to)) {
		return "終日";
	}
	if (!from) {
		return `〜${to}`;
	}
	if (!to) {
		return `${from}〜`;
	}
	return `${from}–${to}`;
}

const dayLabelFormat = new Intl.DateTimeFormat("ja-JP", {
	month: "long",
	day: "numeric",
	weekday: "short",
});

/** "11月5日(木)" */
export function formatDayLabel(date: Date): string {
	return dayLabelFormat.format(date);
}

/** "11月2日〜8日", or "10月27日〜11月2日" across months. */
export function formatWeekLabel(weekStart: Date): string {
	const weekEnd = addDays(weekStart, 6);
	const startLabel = `${weekStart.getMonth() + 1}月${weekStart.getDate()}日`;
	const endLabel =
		weekEnd.getMonth() === weekStart.getMonth()
			? `${weekEnd.getDate()}日`
			: `${weekEnd.getMonth() + 1}月${weekEnd.getDate()}日`;
	return `${startLabel}〜${endLabel}`;
}
