import { describe, expect, it } from "vitest";

import { clampHour, MAX_HOUR, MIN_HOUR, stepHour } from "../hour-zoom";

describe("stepHour", () => {
	it("moves to the next step from a step or from between two", () => {
		expect(stepHour(48, 1)).toBe(56);
		expect(stepHour(48, -1)).toBe(40);
		expect(stepHour(50, 1)).toBe(56);
		expect(stepHour(50, -1)).toBe(48);
	});

	it("stays at either end", () => {
		expect(stepHour(MAX_HOUR, 1)).toBe(MAX_HOUR);
		expect(stepHour(MIN_HOUR, -1)).toBe(MIN_HOUR);
	});
});

describe("clampHour", () => {
	it("keeps a pinch inside the steps, in whole pixels", () => {
		expect(clampHour(3)).toBe(MIN_HOUR);
		expect(clampHour(500)).toBe(MAX_HOUR);
		expect(clampHour(61.4)).toBe(61);
	});
});
