import { describe, expect, it } from "vitest";

import {
	makeLabel,
	makeProject,
	makeTask,
} from "../../__tests__/task-fixtures";
import {
	dueTone,
	flattenProjects,
	formatDay,
	formatRecurrence,
	groupTasks,
	parseQuickAdd,
	projectPath,
} from "../tasks";

const TODAY = "2026-11-05";

const projects = [
	makeProject({ id: "uni", name: "大学" }),
	makeProject({ id: "lab", name: "研究", parentId: "uni" }),
	makeProject({ id: "home", name: "家", sortOrder: 1 }),
];
const labels = [
	makeLabel({ id: "next", name: "next" }),
	makeLabel({ id: "errand", name: "@外出" }),
];

describe("parseQuickAdd", () => {
	it("reads priority, project, label and date tokens", () => {
		expect(
			parseQuickAdd("論文を読む p1 #研究 @next 明日", {
				labels,
				projects,
				today: TODAY,
			})
		).toEqual({
			labelIds: ["next"],
			priority: 1,
			projectId: "lab",
			scheduledDate: "2026-11-06",
			title: "論文を読む",
		});
	});

	it("matches labels whose own name starts with @ and ignores repeats", () => {
		const result = parseQuickAdd("切手 @外出 @@外出 今日", {
			labels,
			projects,
			today: TODAY,
		});
		expect(result.labelIds).toEqual(["errand"]);
		expect(result.scheduledDate).toBe(TODAY);
	});

	it("keeps unknown tokens in the title", () => {
		const result = parseQuickAdd("#未登録 @なし 明後日 P3 #", {
			labels,
			projects,
			today: TODAY,
		});
		expect(result.title).toBe("#未登録 @なし #");
		expect(result.priority).toBe(3);
		expect(result.scheduledDate).toBe("2026-11-07");
		expect(result.projectId).toBeUndefined();
	});

	it("reads words every object inherits as plain title text", () => {
		const result = parseQuickAdd("fix toString and constructor bug", {
			labels,
			projects,
			today: TODAY,
		});
		expect(result.title).toBe("fix toString and constructor bug");
		expect(result.scheduledDate).toBeUndefined();
	});
});

describe("formatRecurrence", () => {
	it("describes each kind of rule", () => {
		expect(
			formatRecurrence({ basis: "schedule", interval: 1, unit: "day" })
		).toBe("毎日");
		expect(
			formatRecurrence({ basis: "schedule", interval: 3, unit: "day" })
		).toBe("3日ごと");
		expect(
			formatRecurrence({
				basis: "schedule",
				interval: 1,
				unit: "week",
				weekdays: [0, 3, 1],
			})
		).toBe("毎週 月・水・日");
		expect(
			formatRecurrence({ basis: "schedule", interval: 2, unit: "week" })
		).toBe("2週ごと");
		expect(
			formatRecurrence({
				basis: "schedule",
				dayOfMonth: 15,
				interval: 1,
				unit: "month",
			})
		).toBe("毎月15日");
		expect(
			formatRecurrence({ basis: "schedule", interval: 3, unit: "month" })
		).toBe("3か月ごと");
		expect(
			formatRecurrence({ basis: "completion", interval: 2, unit: "week" })
		).toBe("完了から2週間後");
	});
});

describe("formatDay and dueTone", () => {
	it("uses relative words near today", () => {
		expect(formatDay("2026-11-05", TODAY)).toBe("今日");
		expect(formatDay("2026-11-06", TODAY)).toBe("明日");
		expect(formatDay("2026-11-04", TODAY)).toBe("昨日");
		expect(formatDay("2026-11-10", TODAY)).toBe("11月10日(火)");
		expect(formatDay("2027-01-04", TODAY)).toBe("2027年1月4日(月)");
		expect(formatDay("bad", TODAY)).toBe("bad");
	});

	it("grades how urgent a date is", () => {
		expect(dueTone("2026-11-01", TODAY)).toBe("overdue");
		expect(dueTone(TODAY, TODAY)).toBe("today");
		expect(dueTone("2026-11-07", TODAY)).toBe("soon");
		expect(dueTone("2026-11-20", TODAY)).toBe("later");
	});
});

describe("project tree", () => {
	it("flattens children after their parent", () => {
		expect(flattenProjects(projects).map((p) => [p.name, p.depth])).toEqual([
			["大学", 0],
			["研究", 1],
			["家", 0],
		]);
	});

	it("treats a missing parent as top level", () => {
		const orphan = makeProject({ id: "x", name: "孤児", parentId: "gone" });
		expect(flattenProjects([orphan])).toHaveLength(1);
	});

	it("builds the path", () => {
		expect(projectPath(projects, "lab")).toBe("大学 / 研究");
		expect(projectPath(projects, null)).toBe("");
	});
});

describe("groupTasks", () => {
	const context = { projects, today: TODAY };

	it("splits overdue work on today", () => {
		const late = makeTask({ id: "late", scheduledDate: "2026-11-01" });
		const now = makeTask({ id: "now", scheduledDate: TODAY });
		expect(
			groupTasks([late, now], "today", context).map((g) => [
				g.title,
				g.tasks.map((t) => t.id),
			])
		).toEqual([
			["期限切れ", ["late"]],
			["今日", ["now"]],
		]);
		expect(groupTasks([now], "today", context)[0]?.title).toBe("");
	});

	it("groups upcoming tasks by their next date", () => {
		const groups = groupTasks(
			[
				makeTask({ id: "b", scheduledDate: "2026-11-08" }),
				makeTask({
					deadline: "2026-11-06",
					id: "a",
					scheduledDate: "2026-11-04",
				}),
				makeTask({ id: "c" }),
			],
			"upcoming",
			context
		);
		expect(groups.map((g) => [g.title, g.tasks.map((t) => t.id)])).toEqual([
			["日付なし", ["c"]],
			["明日", ["a"]],
			["11月8日(日)", ["b"]],
		]);
	});

	it("groups all open tasks by project in tree order", () => {
		const groups = groupTasks(
			[
				makeTask({ id: "home", projectId: "home" }),
				makeTask({ id: "lab", projectId: "lab" }),
				makeTask({ id: "inbox" }),
				makeTask({ id: "lost", projectId: "deleted" }),
			],
			"open",
			context
		);
		expect(groups.map((g) => g.title)).toEqual([
			"インボックス",
			"大学 / 研究",
			"家",
			"不明",
		]);
	});

	it("keeps the inbox as one untitled list", () => {
		expect(groupTasks([], "inbox", context)).toEqual([]);
		expect(groupTasks([makeTask()], "inbox", context)[0]?.title).toBe("");
	});
});
