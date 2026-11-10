import { describe, expect, it } from "vitest";

import { makeTask } from "../../../__tests__/task-fixtures";
import {
	draftError,
	draftFromTask,
	draftRecurrence,
	draftToInput,
} from "../task-draft";

describe("task drafts", () => {
	it("starts a new draft from the view's defaults", () => {
		const draft = draftFromTask(null, {
			projectId: "p",
			scheduledDate: "2026-11-05",
		});
		expect(draft).toMatchObject({
			priority: 4,
			projectId: "p",
			repeat: "none",
			scheduledDate: "2026-11-05",
			title: "",
		});
	});

	it("round-trips an existing task", () => {
		const task = makeTask({
			deadline: "2026-11-20",
			estimateMinutes: 30,
			labels: [{ id: "l", name: "next" }],
			priority: 2,
			projectId: "p",
			recurrence: {
				basis: "schedule",
				interval: 1,
				unit: "week",
				weekdays: [5, 1],
			},
			scheduledDate: "2026-11-06",
			scheduledTime: "09:30",
			startDate: "2026-11-02",
		});
		expect(draftToInput(draftFromTask(task, { projectId: "other" }))).toEqual({
			deadline: "2026-11-20",
			estimateMinutes: 30,
			labelIds: ["l"],
			note: "",
			priority: 2,
			projectId: "p",
			recurrence: {
				basis: "schedule",
				interval: 1,
				unit: "week",
				weekdays: [1, 5],
			},
			scheduledDate: "2026-11-06",
			scheduledTime: "09:30",
			startDate: "2026-11-02",
			title: "牛乳を買う",
		});
	});

	it("turns empty fields into null", () => {
		const input = draftToInput({
			...draftFromTask(null),
			estimate: "0",
			title: "  掃除  ",
		});
		expect(input).toMatchObject({
			deadline: null,
			estimateMinutes: null,
			projectId: null,
			recurrence: null,
			title: "掃除",
		});
	});

	it("builds recurrence rules from the form", () => {
		const base = draftFromTask(null);
		expect(
			draftRecurrence({
				...base,
				dayOfMonth: "40",
				interval: "2",
				repeat: "schedule",
				unit: "month",
			})
		).toEqual({
			basis: "schedule",
			dayOfMonth: 31,
			interval: 2,
			unit: "month",
		});
		expect(
			draftRecurrence({
				...base,
				interval: "",
				repeat: "completion",
				unit: "week",
				weekdays: [1],
			})
		).toEqual({ basis: "completion", interval: 1, unit: "week" });
	});

	it("explains what blocks saving", () => {
		const base = { ...draftFromTask(null), title: "やる" };
		expect(draftError({ ...base, title: " " })).toBe(
			"タイトルを入力してください"
		);
		expect(
			draftError({
				...base,
				scheduledDate: "2026-11-05",
				startDate: "2026-11-06",
			})
		).toBe("着手日は予定日や締め切りより前にしてください");
		expect(
			draftError({
				...base,
				deadline: "2026-11-04",
				scheduledDate: "2026-11-05",
			})
		).toBe("予定日は締め切りより前にしてください");
		expect(draftError(base)).toBeNull();
	});
});
