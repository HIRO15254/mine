import { describe, expect, it } from "vitest";

import { type ClaudeThread, formatUpdated, sortThreads } from "../threads";

const thread = (
	id: string,
	status: ClaudeThread["status"],
	updatedAt: number
): ClaudeThread => ({
	id,
	nextAction: "",
	projectId: null,
	status,
	summary: "",
	title: id,
	updatedAt,
	url: null,
});

describe("sortThreads", () => {
	it("puts waiting threads first, newest first", () => {
		const sorted = sortThreads([
			thread("old-working", "working", 1),
			thread("waiting", "waiting", 0),
			thread("new-working", "working", 2),
		]);
		expect(sorted.map((item) => item.id)).toEqual([
			"waiting",
			"new-working",
			"old-working",
		]);
	});
});

describe("formatUpdated", () => {
	it("shows the time today and the date before", () => {
		const now = new Date(2026, 10, 6, 15, 0).getTime();
		expect(formatUpdated(new Date(2026, 10, 6, 9, 5).getTime(), now)).toBe(
			"09:05"
		);
		expect(formatUpdated(new Date(2026, 10, 5, 23, 0).getTime(), now)).toBe(
			"11/5 23:00"
		);
	});
});
