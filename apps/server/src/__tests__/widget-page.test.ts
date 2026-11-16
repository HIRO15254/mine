import { describe, expect, it } from "vitest";

import { widgetPage } from "../widget-page";

describe("widgetPage", () => {
	it("shows the running timer, events and the tasks left over", () => {
		const html = widgetPage(
			{
				events: [
					{
						allDay: true,
						color: "#16a765",
						current: true,
						end: null,
						start: null,
						title: "祝日",
					},
					{
						allDay: false,
						color: "red; background: url(x)",
						current: true,
						end: "11:00",
						start: "10:00",
						title: "会議",
					},
				],
				moreTasks: 2,
				now: "10:30",
				tasks: [
					{
						overdue: false,
						priority: 2,
						project: null,
						projectColor: null,
						time: "13:00",
						title: "電話",
					},
				],
				timer: {
					description: null,
					elapsed: "0:42",
					project: "仕事 / 開発",
					projectColor: "chart-1",
					startedAt: "09:48",
				},
				today: "2026-11-16",
			},
			"auto"
		);

		expect(html).toContain("11月16日（月）");
		expect(html).toContain("10:30 更新");
		expect(html).toContain("0:42");
		expect(html).toContain("説明なし");
		expect(html).toContain("仕事 / 開発・09:48 から");
		expect(html).toContain("終日");
		expect(html).toContain('style="background: #16a765"');
		expect(html).not.toContain("url(x)");
		expect(html).toContain('class="now"');
		expect(html).toContain("ほか 2 件");
	});

	it("says so when the day is clear", () => {
		const html = widgetPage(
			{
				events: [],
				moreTasks: 0,
				now: "22:00",
				tasks: [],
				timer: {
					description: "読書",
					elapsed: "0:10",
					project: null,
					projectColor: null,
					startedAt: "21:50",
				},
				today: "2026-11-15",
			},
			"light"
		);

		expect(html).toContain("11月15日（日）");
		expect(html).toContain("今日の残りの予定はありません");
		expect(html).toContain("今日のタスクはありません");
		expect(html).toContain("21:50 から");
	});
});
