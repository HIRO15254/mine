import { describe, expect, it } from "vitest";

import { clampHour, fittedHour, MAX_HOUR, stepHour } from "../hour-zoom";

describe("stepHour", () => {
	it("moves to the next step from a step or from between two", () => {
		expect(stepHour(48, 1, 30)).toBe(56);
		expect(stepHour(48, -1, 30)).toBe(40);
		expect(stepHour(50, 1, 30)).toBe(56);
		expect(stepHour(50, -1, 30)).toBe(48);
	});

	it("ends at the fitted scale and skips steps below it", () => {
		expect(stepHour(32, -1, 30.5)).toBe(30.5);
		expect(stepHour(40, -1, 35)).toBe(35);
		expect(stepHour(35, 1, 35)).toBe(40);
		expect(stepHour(30.5, -1, 30.5)).toBe(30.5);
		expect(stepHour(MAX_HOUR, 1, 30)).toBe(MAX_HOUR);
	});
});

describe("clampHour", () => {
	it("keeps a pinch between the fitted scale and the largest, in whole pixels", () => {
		expect(clampHour(3, 30.5)).toBe(30.5);
		expect(clampHour(500, 30.5)).toBe(MAX_HOUR);
		expect(clampHour(61.4, 30.5)).toBe(61);
	});
});

describe("fittedHour", () => {
	it("shares the room under the sticky rows between the 24 hours", () => {
		// 48px of header, then 76px of day and 終日 rows, then 24 × 31px.
		expect(fittedHour(868, 48, 76)).toBe(31);
	});

	it("is unknown before there is anything to measure", () => {
		expect(fittedHour(0, 0, 0)).toBeNull();
	});

	it("stays readable in a very short window", () => {
		expect(fittedHour(200, 48, 76)).toBe(16);
	});
});
