import { describe, expect, it } from "vitest";

import {
	addDays,
	type DisplayEvent,
	dayKey,
	eventsOnDay,
	formatClock,
	formatDayLabel,
	formatEventTime,
	formatWeekLabel,
	parseDayKey,
	rangeOfDays,
	startOfWeek,
} from "../calendar-time";

function event(overrides: Partial<DisplayEvent>): DisplayEvent {
	return {
		allDay: false,
		calendarId: "c",
		color: "#000",
		end: "2026-11-05T11:00:00+09:00",
		description: null,
		htmlLink: null,
		recurring: false,
		id: "e",
		location: null,
		start: "2026-11-05T10:00:00+09:00",
		title: "予定",
		...overrides,
	};
}

describe("day keys", () => {
	it("round-trips a local date and rejects invalid ones", () => {
		const date = new Date(2026, 10, 5);
		expect(dayKey(date)).toBe("2026-11-05");
		expect(parseDayKey("2026-11-05")?.getTime()).toBe(date.getTime());
		expect(parseDayKey("2026-02-30")).toBeNull();
		expect(parseDayKey("nope")).toBeNull();
		expect(parseDayKey(undefined)).toBeNull();
	});
});

describe("weeks and ranges", () => {
	it("starts weeks on Monday", () => {
		expect(dayKey(startOfWeek(new Date(2026, 10, 5)))).toBe("2026-11-02");
		expect(dayKey(startOfWeek(new Date(2026, 10, 8)))).toBe("2026-11-02");
		expect(dayKey(startOfWeek(new Date(2026, 10, 9)))).toBe("2026-11-09");
	});

	it("covers whole local days", () => {
		expect(rangeOfDays(new Date(2026, 10, 5, 15), 1)).toEqual({
			timeMin: "2026-11-04T15:00:00.000Z",
			timeMax: "2026-11-05T15:00:00.000Z",
		});
	});

	it("labels weeks within and across months", () => {
		expect(formatWeekLabel(new Date(2026, 10, 2))).toBe("11月2日〜8日");
		expect(formatWeekLabel(new Date(2026, 9, 26))).toBe("10月26日〜11月1日");
		expect(formatDayLabel(new Date(2026, 10, 5))).toBe("11月5日(木)");
	});
});

describe("eventsOnDay", () => {
	const day = new Date(2026, 10, 5);

	it("keeps overlapping events with all-day ones first", () => {
		const events = [
			event({
				id: "late",
				start: "2026-11-05T18:00:00+09:00",
				end: "2026-11-05T19:00:00+09:00",
			}),
			event({ id: "early" }),
			event({
				id: "allday",
				allDay: true,
				start: "2026-11-05",
				end: "2026-11-06",
			}),
			event({
				id: "multi",
				allDay: true,
				start: "2026-11-03",
				end: "2026-11-06",
			}),
			event({
				id: "overnight",
				start: "2026-11-04T23:00:00+09:00",
				end: "2026-11-05T01:00:00+09:00",
			}),
			event({
				id: "yesterday",
				allDay: true,
				start: "2026-11-04",
				end: "2026-11-05",
			}),
			event({
				id: "tomorrow",
				start: "2026-11-06T00:00:00+09:00",
				end: "2026-11-06T01:00:00+09:00",
			}),
		];

		expect(eventsOnDay(events, day).map((e) => e.id)).toEqual([
			"multi",
			"allday",
			"overnight",
			"early",
			"late",
		]);
	});

	it("keeps a zero-length event at the start of the day", () => {
		const point = event({
			start: "2026-11-05T00:00:00+09:00",
			end: "2026-11-05T00:00:00+09:00",
		});
		expect(eventsOnDay([point], day)).toHaveLength(1);
		expect(eventsOnDay([point], addDays(day, -1))).toHaveLength(0);
	});
});

describe("formatEventTime", () => {
	const day = new Date(2026, 10, 5);

	it("formats all-day, same-day and spanning events", () => {
		expect(formatEventTime(event({ allDay: true }), day)).toBe("終日");
		expect(formatEventTime(event({}), day)).toBe("10:00–11:00");
		expect(
			formatEventTime(event({ start: "2026-11-04T23:00:00+09:00" }), day)
		).toBe("〜11:00");
		expect(
			formatEventTime(event({ end: "2026-11-06T02:00:00+09:00" }), day)
		).toBe("10:00〜");
		expect(
			formatEventTime(
				event({
					start: "2026-11-04T09:00:00+09:00",
					end: "2026-11-06T09:00:00+09:00",
				}),
				day
			)
		).toBe("終日");
	});
});

describe("formatClock", () => {
	it("shows an instant as a 24-hour local time", () => {
		expect(formatClock(new Date(2026, 10, 5, 9, 5).getTime())).toBe("09:05");
		expect(formatClock(new Date(2026, 10, 5, 0, 0).getTime())).toBe("00:00");
		expect(formatClock(new Date(2026, 10, 5, 23, 59).getTime())).toBe("23:59");
	});
});
