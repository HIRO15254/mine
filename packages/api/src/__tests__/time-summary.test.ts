import { describe, expect, it } from "vitest";

import { isTimeZone, localDay, rateFor, summarize } from "../time/summary";

const projects = [
	{ id: "work", parentId: null },
	{ id: "client", parentId: "work" },
	{ id: "hobby", parentId: null },
];
const rates = [
	{ effectiveFrom: "2026-01-01", hourlyRate: 1000, projectId: "work" },
	{ effectiveFrom: "2026-11-01", hourlyRate: 1200, projectId: "work" },
	{ effectiveFrom: "2026-11-10", hourlyRate: 3000, projectId: "client" },
];
const HOUR = 3_600_000;
/** 2026-11-05 00:00 in Tokyo. */
const NOV5 = Date.UTC(2026, 10, 4, 15);

describe("localDay", () => {
	it("uses the given time zone", () => {
		expect(localDay(NOV5, "Asia/Tokyo")).toBe("2026-11-05");
		expect(localDay(NOV5, "UTC")).toBe("2026-11-04");
		expect(isTimeZone("Asia/Tokyo")).toBe(true);
		expect(isTimeZone("Mars/Base")).toBe(false);
	});
});

describe("rateFor", () => {
	it("takes the latest rate in effect, inheriting from parents", () => {
		expect(rateFor("work", "2026-10-31", projects, rates)).toBe(1000);
		expect(rateFor("work", "2026-11-01", projects, rates)).toBe(1200);
		expect(rateFor("client", "2026-11-09", projects, rates)).toBe(1200);
		expect(rateFor("client", "2026-11-10", projects, rates)).toBe(3000);
		expect(rateFor("work", "2025-12-31", projects, rates)).toBeNull();
		expect(rateFor("hobby", "2026-11-10", projects, rates)).toBeNull();
		expect(rateFor(null, "2026-11-10", projects, rates)).toBeNull();
	});
});

describe("summarize", () => {
	it("clips to the range, counts the running entry and prices billable time", () => {
		const summary = summarize(
			[
				// Starts an hour before the range: only 1h counts.
				{
					billable: true,
					endedAt: NOV5 + HOUR,
					projectId: "client",
					startedAt: NOV5 - HOUR,
				},
				{
					billable: false,
					endedAt: NOV5 + 3 * HOUR,
					projectId: "work",
					startedAt: NOV5 + 2 * HOUR,
				},
				{
					billable: true,
					endedAt: NOV5 + 26 * HOUR,
					projectId: "work",
					startedAt: NOV5 + 24 * HOUR,
				},
				// Running: counts until now.
				{
					billable: true,
					endedAt: null,
					projectId: "hobby",
					startedAt: NOV5 + 30 * HOUR,
				},
				// Outside the range.
				{
					billable: true,
					endedAt: NOV5 - HOUR,
					projectId: "work",
					startedAt: NOV5 - 2 * HOUR,
				},
			],
			{
				from: NOV5,
				now: NOV5 + 30.5 * HOUR,
				projects,
				rates,
				timeZone: "Asia/Tokyo",
				to: NOV5 + 7 * 24 * HOUR,
			}
		);

		expect(summary.durationMs).toBe(4.5 * HOUR);
		expect(summary.amount).toBe(1200 + 2 * 1200);
		expect(summary.projects).toEqual([
			{ amount: 2400, durationMs: 3 * HOUR, projectId: "work" },
			{ amount: 1200, durationMs: HOUR, projectId: "client" },
			{ amount: null, durationMs: 0.5 * HOUR, projectId: "hobby" },
		]);
		expect(summary.days).toEqual([
			{ day: "2026-11-05", durationMs: 2 * HOUR },
			{ day: "2026-11-06", durationMs: 2.5 * HOUR },
		]);
	});

	it("books an entry that crosses midnight to both days, each at its rate", () => {
		// 2026-11-09 22:00 to 2026-11-10 01:00 in Tokyo; the rate changes on the 10th.
		const NOV10 = NOV5 + 5 * 24 * HOUR;
		const summary = summarize(
			[
				{
					billable: true,
					endedAt: NOV10 + HOUR,
					projectId: "client",
					startedAt: NOV10 - 2 * HOUR,
				},
			],
			{
				from: NOV5,
				now: NOV10 + HOUR,
				projects,
				rates,
				timeZone: "Asia/Tokyo",
				to: NOV5 + 7 * 24 * HOUR,
			}
		);

		expect(summary.days).toEqual([
			{ day: "2026-11-09", durationMs: 2 * HOUR },
			{ day: "2026-11-10", durationMs: HOUR },
		]);
		expect(summary.amount).toBe(2 * 1200 + 3000);
		expect(summary.durationMs).toBe(3 * HOUR);
	});
});
