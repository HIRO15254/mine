import { describe, expect, it } from "vitest";

import {
	combineDayAndTime,
	currentTimeZone,
	dayRange,
	entryDuration,
	formatDuration,
	formatElapsed,
	formatHours,
	formatYen,
	groupEntriesByDay,
	type TimeEntry,
	weekRange,
} from "../time";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
/** 2026-11-05 09:00 in Tokyo (the test time zone). */
const NOV5_9AM = new Date(2026, 10, 5, 9).getTime();

function entry(overrides: Partial<TimeEntry>): TimeEntry {
	return {
		billable: true,
		description: "",
		endedAt: null,
		id: "e",
		projectId: null,
		startedAt: NOV5_9AM,
		taskId: null,
		...overrides,
	};
}

describe("time formatting", () => {
	it("formats elapsed time and totals", () => {
		expect(formatElapsed(65_000)).toBe("0:01:05");
		expect(formatElapsed(-5)).toBe("0:00:00");
		expect(formatElapsed(12 * HOUR + 3 * MINUTE)).toBe("12:03:00");
		expect(formatDuration(45 * MINUTE + 59_000)).toBe("45分");
		expect(formatDuration(2 * HOUR)).toBe("2時間");
		expect(formatDuration(2 * HOUR + 5 * MINUTE)).toBe("2時間5分");
		expect(formatHours(2.54 * HOUR)).toBe("2.5h");
		expect(formatHours(12.4 * HOUR)).toBe("12h");
		expect(formatYen(12_000)).toContain("12,000");
		expect(currentTimeZone()).toBe("Asia/Tokyo");
	});
});

describe("combineDayAndTime", () => {
	it("builds a local instant", () => {
		expect(combineDayAndTime("2026-11-05", "09:00")).toBe(NOV5_9AM);
		expect(combineDayAndTime("2026-11-05", "24:00")).toBeNull();
		expect(combineDayAndTime("2026-11-05", "9:00")).toBeNull();
		expect(combineDayAndTime("bad", "09:00")).toBeNull();
	});
});

describe("ranges", () => {
	it("spans Monday to Monday and one day", () => {
		const week = weekRange(new Date(NOV5_9AM));
		expect(new Date(week.from)).toEqual(new Date(2026, 10, 2));
		expect(new Date(week.to)).toEqual(new Date(2026, 10, 9));
		const day = dayRange(new Date(NOV5_9AM));
		expect(day.to - day.from).toBe(24 * HOUR);
	});
});

describe("groupEntriesByDay", () => {
	it("groups by start day, newest first, counting running time", () => {
		const now = NOV5_9AM + 2 * HOUR;
		const days = groupEntriesByDay(
			[
				entry({ endedAt: NOV5_9AM + HOUR, id: "a" }),
				entry({ id: "b", startedAt: NOV5_9AM + 1.5 * HOUR }),
				entry({
					endedAt: NOV5_9AM - 23 * HOUR,
					id: "c",
					startedAt: NOV5_9AM - 24 * HOUR,
				}),
			],
			now
		);
		expect(
			days.map((day) => [
				day.title,
				day.entries.map((item) => item.id),
				day.totalMs,
			])
		).toEqual([
			["今日", ["b", "a"], 1.5 * HOUR],
			["昨日", ["c"], HOUR],
		]);
		expect(entryDuration(entry({ startedAt: now + HOUR }), now)).toBe(0);
	});
});
