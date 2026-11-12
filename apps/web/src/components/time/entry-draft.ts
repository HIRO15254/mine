import { dayKey, formatClock } from "@/lib/calendar-time";
import { combineDayAndTime, type TimeEntry } from "@/lib/time";

const DAY = 86_400_000;
const FIVE_MINUTES = 300_000;

export interface EntryDraft {
	billable: boolean;
	day: string;
	description: string;
	end: string;
	projectId: string;
	/** A running entry has no end time to edit. */
	running: boolean;
	start: string;
}

/** A new entry defaults to the half hour before now, on 5-minute marks. */
export function draftFromEntry(
	entry: TimeEntry | null,
	now: number,
	defaults: { projectId?: string | null } = {}
): EntryDraft {
	if (entry) {
		return {
			billable: entry.billable,
			day: dayKey(new Date(entry.startedAt)),
			description: entry.description,
			end: entry.endedAt === null ? "" : formatClock(entry.endedAt),
			projectId: entry.projectId ?? "",
			running: entry.endedAt === null,
			start: formatClock(entry.startedAt),
		};
	}
	const end = Math.floor(now / FIVE_MINUTES) * FIVE_MINUTES;
	const start = end - 6 * FIVE_MINUTES;
	return {
		billable: true,
		day: dayKey(new Date(start)),
		description: "",
		end: formatClock(end),
		projectId: defaults.projectId ?? "",
		running: false,
		start: formatClock(start),
	};
}

export type DraftTimes =
	| { endedAt: number | null; error?: undefined; startedAt: number }
	| { error: string };

/**
 * Reads the start and end. An end at or before the start is taken to be on
 * the next day, so 23:00–01:00 works.
 */
export function draftTimes(draft: EntryDraft, now: number): DraftTimes {
	const startedAt = combineDayAndTime(draft.day, draft.start);
	if (startedAt === null) {
		return { error: "開始の日時を入力してください" };
	}
	if (draft.running) {
		return startedAt > now
			? { error: "開始を未来にはできません" }
			: { endedAt: null, startedAt };
	}
	let endedAt = combineDayAndTime(draft.day, draft.end);
	if (endedAt === null) {
		return { error: "終了の時刻を入力してください" };
	}
	if (endedAt <= startedAt) {
		endedAt += DAY;
	}
	return { endedAt, startedAt };
}

/**
 * The times to send when editing `entry`: only the ones whose fields changed.
 * The form shows minutes, so sending an untouched time back would drop its
 * seconds and could push the end of a short entry to the next day.
 */
export function editedTimes(
	entry: TimeEntry,
	draft: EntryDraft,
	times: { endedAt: number | null; startedAt: number }
): { endedAt?: number; startedAt?: number } {
	const before = draftFromEntry(entry, 0);
	const sameDay = draft.day === before.day;
	const startKept = sameDay && draft.start === before.start;
	const startedAt = startKept ? entry.startedAt : times.startedAt;
	const endKept =
		entry.endedAt !== null &&
		sameDay &&
		draft.end === before.end &&
		entry.endedAt > startedAt;
	return {
		...(startKept ? {} : { startedAt }),
		...(endKept || times.endedAt === null ? {} : { endedAt: times.endedAt }),
	};
}
