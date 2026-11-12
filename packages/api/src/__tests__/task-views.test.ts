import { describe, expect, it } from "vitest";

import { compareTasks, inView, type ViewTask } from "../tasks/views";

const today = "2026-11-05";

function item(overrides: Partial<ViewTask>): ViewTask {
	return {
		createdAt: new Date(0),
		deadline: null,
		labels: [],
		priority: 4,
		projectId: "p",
		scheduledDate: null,
		startDate: null,
		...overrides,
	};
}

describe("inView", () => {
	it("shows due, overdue and next-action tasks on today", () => {
		expect(inView(item({ scheduledDate: today }), "today", today)).toBe(true);
		expect(inView(item({ scheduledDate: "2026-11-01" }), "today", today)).toBe(
			true
		);
		expect(inView(item({ deadline: today }), "today", today)).toBe(true);
		expect(inView(item({ labels: [{ name: "Next" }] }), "today", today)).toBe(
			true
		);
		expect(inView(item({ scheduledDate: "2026-11-06" }), "today", today)).toBe(
			false
		);
		expect(inView(item({}), "today", today)).toBe(false);
	});

	it("hides tasks that cannot start yet", () => {
		expect(
			inView(
				item({ labels: [{ name: "next" }], startDate: "2026-11-06" }),
				"today",
				today
			)
		).toBe(false);
	});

	it("lists inbox and upcoming tasks", () => {
		expect(inView(item({ projectId: null }), "inbox", today)).toBe(true);
		expect(inView(item({}), "inbox", today)).toBe(false);
		expect(inView(item({ deadline: "2026-11-19" }), "upcoming", today)).toBe(
			true
		);
		expect(inView(item({ deadline: "2026-11-20" }), "upcoming", today)).toBe(
			false
		);
		expect(inView(item({ scheduledDate: today }), "upcoming", today)).toBe(
			false
		);
		expect(inView(item({}), "open", today)).toBe(true);
	});
});

describe("compareTasks", () => {
	it("orders by priority, then date, then age", () => {
		const tasks = [
			item({
				createdAt: new Date("2026-10-02T00:00:00Z"),
				priority: 4,
				scheduledDate: "2026-11-01",
			}),
			item({ priority: 1 }),
			item({ priority: 4, deadline: "2026-11-02" }),
			item({
				createdAt: new Date("2026-10-01T00:00:00Z"),
				priority: 4,
				scheduledDate: "2026-11-01",
			}),
		];
		expect([...tasks].sort(compareTasks)).toEqual([
			tasks[1],
			tasks[3],
			tasks[0],
			tasks[2],
		]);
	});
});
