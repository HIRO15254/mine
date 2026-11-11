import { z } from "zod";

import {
	addDays,
	addMonths,
	dayOfMonth,
	diffDays,
	maxDay,
	weekday,
} from "./dates";

/**
 * A deliberately small recurrence model:
 * every N days, every N weeks (optionally on given weekdays), or every N
 * months on a day of the month. `completion` counts from the day the task
 * is completed instead of from its schedule ("完了からN日後").
 */
export const recurrenceSchema = z.object({
	basis: z.enum(["schedule", "completion"]),
	interval: z.number().int().min(1).max(365),
	unit: z.enum(["day", "week", "month"]),
	/** 0 = Sunday … 6 = Saturday; only for weekly, schedule-based rules. */
	weekdays: z.array(z.number().int().min(0).max(6)).max(7).optional(),
	/** 1–31; only for monthly, schedule-based rules. Clamped to month end. */
	dayOfMonth: z.number().int().min(1).max(31).optional(),
});

export type Recurrence = z.infer<typeof recurrenceSchema>;

export function parseRecurrence(value: string | null): Recurrence | null {
	if (!value) {
		return null;
	}
	try {
		const parsed = recurrenceSchema.safeParse(JSON.parse(value));
		return parsed.success ? parsed.data : null;
	} catch {
		return null;
	}
}

export function serializeRecurrence(value: Recurrence | null): string | null {
	return value ? JSON.stringify(value) : null;
}

function nextWeekly(rule: Recurrence, anchor: string, after: string): string {
	const weekdays = rule.weekdays?.length ? rule.weekdays : [weekday(anchor)];
	// Monday of the anchor's week, so "every 2 weeks" keeps the same cadence.
	const anchorWeek = addDays(anchor, -((weekday(anchor) + 6) % 7));
	for (let offset = 1; offset <= 7 * rule.interval * 2 + 7; offset += 1) {
		const day = addDays(after, offset);
		const week = Math.floor(diffDays(anchorWeek, day) / 7);
		if (week % rule.interval === 0 && weekdays.includes(weekday(day))) {
			return day;
		}
	}
	throw new Error("No weekly occurrence found");
}

function nextMonthly(rule: Recurrence, anchor: string, after: string): string {
	// Step 0 is the rule's day in the anchor's own month, which can still be
	// ahead (a task on the 28th that repeats on the 31st).
	for (let step = 0; step <= 1200; step += 1) {
		const day = addMonths(anchor, step * rule.interval, rule.dayOfMonth);
		if (day > after) {
			return day;
		}
	}
	throw new Error("No monthly occurrence found");
}

function nextDaily(rule: Recurrence, anchor: string, after: string): string {
	const gap = diffDays(anchor, after);
	const steps = Math.floor(gap / rule.interval) + 1;
	return addDays(anchor, Math.max(1, steps) * rule.interval);
}

/**
 * The day of the next occurrence. A schedule-based rule moves past both the
 * anchor and today, so an overdue task does not reappear in the past.
 */
export function nextOccurrence(
	rule: Recurrence,
	anchor: string,
	today: string
): string {
	if (rule.basis === "completion") {
		if (rule.unit === "month") {
			return addMonths(today, rule.interval);
		}
		return addDays(today, rule.interval * (rule.unit === "week" ? 7 : 1));
	}
	const after = maxDay(anchor, today);
	if (rule.unit === "week") {
		return nextWeekly(rule, anchor, after);
	}
	if (rule.unit === "month") {
		return nextMonthly(rule, anchor, after);
	}
	return nextDaily(rule, anchor, after);
}

export interface TaskDates {
	deadline: string | null;
	scheduledDate: string | null;
	startDate: string | null;
}

/** The date a recurring task counts from: its schedule, else its deadline. */
export function anchorDay(dates: TaskDates, today: string): string {
	return dates.scheduledDate ?? dates.deadline ?? dates.startDate ?? today;
}

/**
 * A monthly rule without a day takes the anchor's. Without it a task on the
 * 31st would land on the 28th in February and stay there ever after.
 */
export function pinDayOfMonth(rule: Recurrence, anchor: string): Recurrence {
	if (rule.unit !== "month" || rule.basis !== "schedule" || rule.dayOfMonth) {
		return rule;
	}
	return { ...rule, dayOfMonth: dayOfMonth(anchor) };
}

/** Moves every date of a recurring task by the same number of days. */
export function advanceDates(
	rule: Recurrence,
	dates: TaskDates,
	today: string
): TaskDates {
	const anchor = anchorDay(dates, today);
	const next = nextOccurrence(rule, anchor, today);
	if (!(dates.scheduledDate || dates.deadline || dates.startDate)) {
		return { deadline: null, scheduledDate: next, startDate: null };
	}
	const shift = diffDays(anchor, next);
	const move = (value: string | null) =>
		value === null ? null : addDays(value, shift);
	return {
		deadline: move(dates.deadline),
		scheduledDate: move(dates.scheduledDate),
		startDate: move(dates.startDate),
	};
}
