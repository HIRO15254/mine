import { addDays } from "../tasks/dates";
import { startOfDayIn } from "./zone";

const dayFormats = new Map<string, Intl.DateTimeFormat>();

/** Local calendar day (YYYY-MM-DD) of an instant in the given time zone. */
export function localDay(ms: number, timeZone: string): string {
	let format = dayFormats.get(timeZone);
	if (!format) {
		format = new Intl.DateTimeFormat("en-CA", {
			day: "2-digit",
			month: "2-digit",
			timeZone,
			year: "numeric",
		});
		dayFormats.set(timeZone, format);
	}
	return format.format(new Date(ms));
}

export function isTimeZone(value: string): boolean {
	try {
		new Intl.DateTimeFormat("en-US", { timeZone: value });
		return true;
	} catch {
		return false;
	}
}

export interface RateProject {
	id: string;
	parentId: string | null;
}

export interface Rate {
	effectiveFrom: string;
	hourlyRate: number;
	projectId: string;
}

/**
 * The hourly rate that applies to a project on a day: the project's own
 * latest rate starting on or before the day, otherwise its nearest
 * ancestor's. Null when nothing up the tree has one.
 */
export function rateFor(
	projectId: string | null,
	day: string,
	projects: RateProject[],
	rates: Rate[]
): number | null {
	const parents = new Map(projects.map((p) => [p.id, p.parentId]));
	let current = projectId;
	for (let depth = 0; current && depth < 100; depth += 1) {
		const id = current;
		const own = rates
			.filter((rate) => rate.projectId === id && rate.effectiveFrom <= day)
			.sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom))[0];
		if (own) {
			return own.hourlyRate;
		}
		current = parents.get(id) ?? null;
	}
	return null;
}

export interface SummaryEntry {
	billable: boolean;
	endedAt: number | null;
	projectId: string | null;
	startedAt: number;
}

export interface ProjectTotal {
	/** Whole yen for billable time, or null when no rate applies. */
	amount: number | null;
	durationMs: number;
	projectId: string | null;
}

export interface TimeSummary {
	amount: number;
	days: Array<{ day: string; durationMs: number }>;
	durationMs: number;
	projects: ProjectTotal[];
}

const HOUR = 3_600_000;

/**
 * Totals entries inside [from, to). Entries are clipped to the range, a
 * running entry counts up to `now`, and an entry that crosses local midnight
 * is booked to each day it covers, at that day's rate.
 */
export function summarize(
	entries: SummaryEntry[],
	options: {
		from: number;
		now: number;
		projects: RateProject[];
		rates: Rate[];
		timeZone: string;
		to: number;
	}
): TimeSummary {
	const { from, now, projects, rates, timeZone, to } = options;
	const byProject = new Map<string | null, ProjectTotal>();
	const byDay = new Map<string, number>();
	const dayEnds = new Map<string, number>();
	const endOf = (day: string) => {
		let end = dayEnds.get(day);
		if (end === undefined) {
			end = startOfDayIn(addDays(day, 1), timeZone);
			dayEnds.set(day, end);
		}
		return end;
	};
	let durationMs = 0;
	let amount = 0;
	for (const entry of entries) {
		const end = Math.min(entry.endedAt ?? now, to);
		let start = Math.max(entry.startedAt, from);
		while (start < end) {
			const day = localDay(start, timeZone);
			const dayEnd = endOf(day);
			// A day boundary that fails to move forward ends the walk.
			const stop = dayEnd > start ? Math.min(dayEnd, end) : end;
			const ms = stop - start;
			const rate = entry.billable
				? rateFor(entry.projectId, day, projects, rates)
				: null;
			const total = byProject.get(entry.projectId) ?? {
				amount: null,
				durationMs: 0,
				projectId: entry.projectId,
			};
			total.durationMs += ms;
			if (rate !== null) {
				const value = (ms / HOUR) * rate;
				total.amount = (total.amount ?? 0) + value;
				amount += value;
			}
			byProject.set(entry.projectId, total);
			byDay.set(day, (byDay.get(day) ?? 0) + ms);
			durationMs += ms;
			start = stop;
		}
	}
	return {
		amount: Math.round(amount),
		days: [...byDay.entries()]
			.sort(([a], [b]) => a.localeCompare(b))
			.map(([day, ms]) => ({ day, durationMs: ms })),
		durationMs,
		projects: [...byProject.values()]
			.map((total) => ({
				...total,
				amount: total.amount === null ? null : Math.round(total.amount),
			}))
			.sort((a, b) => b.durationMs - a.durationMs),
	};
}
