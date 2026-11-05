import { describe, expect, it } from "vitest";

import { addMonths, isDayKey } from "../tasks/dates";
import {
	advanceDates,
	nextOccurrence,
	parseRecurrence,
	type Recurrence,
	serializeRecurrence,
} from "../tasks/recurrence";

const rule = (overrides: Partial<Recurrence>): Recurrence => ({
	basis: "schedule",
	interval: 1,
	unit: "day",
	...overrides,
});

describe("dates", () => {
	it("validates day keys and clamps month ends", () => {
		expect(isDayKey("2026-02-28")).toBe(true);
		expect(isDayKey("2026-02-30")).toBe(false);
		expect(isDayKey("2026-2-1")).toBe(false);
		expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
		expect(addMonths("2026-11-15", 2, 31)).toBe("2027-01-31");
	});
});

describe("nextOccurrence", () => {
	it("repeats every N days from the schedule", () => {
		expect(nextOccurrence(rule({}), "2026-11-05", "2026-11-05")).toBe(
			"2026-11-06"
		);
		expect(
			nextOccurrence(rule({ interval: 3 }), "2026-11-05", "2026-11-05")
		).toBe("2026-11-08");
	});

	it("skips past today for an overdue task", () => {
		expect(
			nextOccurrence(rule({ interval: 2 }), "2026-11-01", "2026-11-05")
		).toBe("2026-11-07");
	});

	it("keeps counting from the schedule when completed early", () => {
		expect(nextOccurrence(rule({}), "2026-11-10", "2026-11-05")).toBe(
			"2026-11-11"
		);
	});

	it("finds the next listed weekday", () => {
		// 2026-11-02 is a Monday.
		const monWed = rule({ unit: "week", weekdays: [1, 3] });
		expect(nextOccurrence(monWed, "2026-11-02", "2026-11-02")).toBe(
			"2026-11-04"
		);
		expect(nextOccurrence(monWed, "2026-11-04", "2026-11-04")).toBe(
			"2026-11-09"
		);
	});

	it("keeps a biweekly cadence", () => {
		const everyOtherMonday = rule({ interval: 2, unit: "week", weekdays: [1] });
		expect(nextOccurrence(everyOtherMonday, "2026-11-02", "2026-11-03")).toBe(
			"2026-11-16"
		);
		expect(
			nextOccurrence(
				rule({ interval: 2, unit: "week" }),
				"2026-11-04",
				"2026-11-04"
			)
		).toBe("2026-11-18");
	});

	it("repeats monthly on a day, clamped to month end", () => {
		const monthly = rule({ dayOfMonth: 31, unit: "month" });
		expect(nextOccurrence(monthly, "2027-01-31", "2027-01-31")).toBe(
			"2027-02-28"
		);
		expect(nextOccurrence(monthly, "2027-02-28", "2027-02-28")).toBe(
			"2027-03-31"
		);
	});

	it("counts from the completion day", () => {
		expect(
			nextOccurrence(
				rule({ basis: "completion", interval: 3 }),
				"2026-10-01",
				"2026-11-05"
			)
		).toBe("2026-11-08");
		expect(
			nextOccurrence(
				rule({ basis: "completion", unit: "week" }),
				"2026-10-01",
				"2026-11-05"
			)
		).toBe("2026-11-12");
		expect(
			nextOccurrence(
				rule({ basis: "completion", unit: "month" }),
				"2026-10-01",
				"2026-11-05"
			)
		).toBe("2026-12-05");
	});
});

describe("advanceDates", () => {
	it("moves all three dates by the same amount", () => {
		expect(
			advanceDates(
				rule({ unit: "week" }),
				{
					startDate: "2026-11-03",
					scheduledDate: "2026-11-05",
					deadline: "2026-11-06",
				},
				"2026-11-05"
			)
		).toEqual({
			startDate: "2026-11-10",
			scheduledDate: "2026-11-12",
			deadline: "2026-11-13",
		});
	});

	it("anchors on the deadline when there is no scheduled date", () => {
		expect(
			advanceDates(
				rule({}),
				{ startDate: null, scheduledDate: null, deadline: "2026-11-05" },
				"2026-11-05"
			)
		).toEqual({ startDate: null, scheduledDate: null, deadline: "2026-11-06" });
	});

	it("schedules a dateless task on its next occurrence", () => {
		expect(
			advanceDates(
				rule({ basis: "completion", interval: 2 }),
				{ startDate: null, scheduledDate: null, deadline: null },
				"2026-11-05"
			)
		).toEqual({ startDate: null, scheduledDate: "2026-11-07", deadline: null });
	});
});

describe("serialization", () => {
	it("round-trips and ignores invalid JSON", () => {
		const value = rule({ unit: "week", weekdays: [1] });
		expect(parseRecurrence(serializeRecurrence(value))).toEqual(value);
		expect(parseRecurrence(null)).toBeNull();
		expect(parseRecurrence("{")).toBeNull();
		expect(parseRecurrence('{"unit":"year"}')).toBeNull();
		expect(serializeRecurrence(null)).toBeNull();
	});
});
