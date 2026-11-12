import { describe, expect, it } from "vitest";

import {
	dropMinutes,
	formatTime,
	layoutDay,
	parseTime,
	placementForDrop,
	STACK_INDENT_PX,
	spanCss,
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
	const at = (placed: ReturnType<typeof layoutDay>) =>
		Object.fromEntries(
			placed.map((item) => [
				item.key,
				{ depth: item.depth, left: item.left, width: item.width },
			])
		);

	it("puts items that start together side by side and the rest full width", () => {
		const placed = at(
			layoutDay(
				[
					{ end: 660, key: "a", start: 600 },
					{ end: 630, key: "b", start: 610 },
					{ end: 800, key: "d", start: 760 },
				],
				25
			)
		);
		expect(placed).toEqual({
			a: { depth: 0, left: { pct: 0, px: 0 }, width: { pct: 50, px: 0 } },
			b: { depth: 0, left: { pct: 50, px: 0 }, width: { pct: 50, px: 0 } },
			d: { depth: 0, left: { pct: 0, px: 0 }, width: { pct: 100, px: 0 } },
		});
	});

	it("draws a later item on top of the running one, moved in so its title shows", () => {
		const placed = at(
			layoutDay(
				[
					{ end: 720, key: "long", start: 540 },
					{ end: 660, key: "later", start: 600 },
					{ end: 700, key: "latest", start: 640 },
				],
				25
			)
		);
		expect(placed).toEqual({
			long: { depth: 0, left: { pct: 0, px: 0 }, width: { pct: 100, px: 0 } },
			later: {
				depth: 1,
				left: { pct: 0, px: STACK_INDENT_PX },
				width: { pct: 100, px: -STACK_INDENT_PX },
			},
			latest: {
				depth: 2,
				left: { pct: 0, px: 2 * STACK_INDENT_PX },
				width: { pct: 100, px: -2 * STACK_INDENT_PX },
			},
		});
	});

	it("splits a stacked block's width with an item that starts beside it", () => {
		const placed = at(
			layoutDay(
				[
					{ end: 720, key: "long", start: 540 },
					{ end: 660, key: "x", start: 600 },
					{ end: 660, key: "y", start: 610 },
				],
				25
			)
		);
		expect(placed.x).toEqual({
			depth: 1,
			left: { pct: 0, px: STACK_INDENT_PX },
			width: { pct: 50, px: -STACK_INDENT_PX / 2 },
		});
		expect(placed.y).toEqual({
			depth: 1,
			left: { pct: 50, px: STACK_INDENT_PX / 2 },
			width: { pct: 50, px: -STACK_INDENT_PX / 2 },
		});
	});

	it("stacks only on the column of the item it overlaps", () => {
		const placed = at(
			layoutDay(
				[
					{ end: 630, key: "a", start: 600 },
					{ end: 720, key: "b", start: 600 },
					{ end: 700, key: "c", start: 660 },
				],
				25
			)
		);
		// The longer b takes the left half; a has ended by 11:00, so c sits on b.
		expect(placed.c).toEqual({
			depth: 1,
			left: { pct: 0, px: STACK_INDENT_PX },
			width: { pct: 50, px: -STACK_INDENT_PX },
		});
	});

	it("writes a span as calc()", () => {
		expect(spanCss({ pct: 50, px: -6 }, 2)).toBe("calc(50% + -4px)");
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
					description: null,
					htmlLink: null,
					recurring: false,
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
					description: null,
					htmlLink: null,
					recurring: false,
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

describe("placementForDrop", () => {
	const unplanned = { scheduledDate: null, scheduledTime: null };
	const timed = { scheduledDate: "2026-11-10", scheduledTime: "09:00" };
	const allDay = { scheduledDate: "2026-11-10", scheduledTime: null };

	it("puts a task on the day and time it is dropped on", () => {
		expect(
			placementForDrop(unplanned, { day: "2026-11-12", kind: "slot" }, 13 * 60)
		).toEqual({ scheduledDate: "2026-11-12", scheduledTime: "13:00" });
		expect(
			placementForDrop(timed, { day: "2026-11-10", kind: "slot" }, 9 * 60 + 15)
		).toEqual({ scheduledDate: "2026-11-10", scheduledTime: "09:15" });
	});

	it("takes the time off on a 終日 row and moves the day", () => {
		expect(
			placementForDrop(timed, { day: "2026-11-11", kind: "allday" }, null)
		).toEqual({ scheduledDate: "2026-11-11", scheduledTime: null });
	});

	it("moves the day and keeps the time on a day of the month view", () => {
		expect(
			placementForDrop(timed, { day: "2026-11-20", kind: "day" }, null)
		).toEqual({ scheduledDate: "2026-11-20", scheduledTime: "09:00" });
		expect(
			placementForDrop(unplanned, { day: "2026-11-20", kind: "day" }, null)
		).toEqual({ scheduledDate: "2026-11-20", scheduledTime: null });
	});

	it("keeps the day when a timed task goes back to the tray", () => {
		expect(placementForDrop(timed, { kind: "tray" }, null)).toEqual({
			scheduledDate: "2026-11-10",
			scheduledTime: null,
		});
	});

	it("changes nothing when the task is dropped where it already is", () => {
		expect(
			placementForDrop(timed, { day: "2026-11-10", kind: "slot" }, 9 * 60)
		).toBeNull();
		expect(
			placementForDrop(allDay, { day: "2026-11-10", kind: "allday" }, null)
		).toBeNull();
		expect(placementForDrop(allDay, { kind: "tray" }, null)).toBeNull();
		expect(placementForDrop(unplanned, { kind: "tray" }, null)).toBeNull();
	});

	it("ignores a drop on the grid that has no landing time", () => {
		expect(
			placementForDrop(unplanned, { day: "2026-11-12", kind: "slot" }, null)
		).toBeNull();
	});
});
