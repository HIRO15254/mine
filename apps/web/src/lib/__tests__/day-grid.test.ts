import { describe, expect, it } from "vitest";

import {
	dropMinutes,
	formatTime,
	layoutDay,
	parseTime,
	timedEventsOn,
} from "../day-grid";

describe("parseTime and formatTime", () => {
	it("reads and writes HH:MM", () => {
		expect(parseTime("09:30")).toBe(570);
		expect(parseTime("24:00")).toBeNull();
		expect(parseTime(null)).toBeNull();
		expect(formatTime(570)).toBe("09:30");
	});
});

describe("layoutDay", () => {
	it("puts overlapping items side by side and the rest full width", () => {
		const placed = layoutDay([
			{ end: 660, key: "a", start: 600 },
			{ end: 630, key: "b", start: 610 },
			{ end: 720, key: "c", start: 640 },
			{ end: 800, key: "d", start: 760 },
		]);
		const byKey = Object.fromEntries(
			placed.map((item) => [item.key, [item.column, item.columns]])
		);
		expect(byKey).toEqual({ a: [0, 2], b: [1, 2], c: [1, 2], d: [0, 1] });
	});
});

describe("timedEventsOn", () => {
	it("clips events to the day and skips all-day ones", () => {
		const day = new Date(2026, 10, 10);
		const items = timedEventsOn(
			[
				{
					allDay: false,
					calendarId: "c",
					color: "#000",
					end: new Date(2026, 10, 10, 2).toISOString(),
					htmlLink: null,
					id: "late",
					location: null,
					start: new Date(2026, 10, 9, 22).toISOString(),
					title: "夜",
				},
				{
					allDay: true,
					calendarId: "c",
					color: "#000",
					end: "2026-11-11",
					htmlLink: null,
					id: "holiday",
					location: null,
					start: "2026-11-10",
					title: "休み",
				},
			],
			day
		);
		expect(items.map((item) => [item.start, item.end])).toEqual([[0, 120]]);
	});
});

describe("dropMinutes", () => {
	it("snaps to 15 minutes and keeps the block inside the day", () => {
		expect(dropMinutes(48 * 13 + 10, 48, 30)).toBe(13 * 60 + 15);
		expect(dropMinutes(-20, 48, 30)).toBe(0);
		expect(dropMinutes(48 * 24, 48, 90)).toBe(24 * 60 - 90);
	});
});
