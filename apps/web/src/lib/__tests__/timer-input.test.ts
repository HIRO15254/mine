import { describe, expect, it } from "vitest";

import { makeProject, makeTask } from "../../__tests__/task-fixtures";
import {
	completeHash,
	findHashTokens,
	hashAtCaret,
	parseTimerText,
	suggestTimer,
	unrecordedEvent,
} from "../timer-input";

const work = makeProject({ id: "work", name: "仕事" });
const projects = [
	makeProject({ id: "lab", name: "研究" }),
	work,
	makeProject({ archived: true, id: "old", name: "研究会" }),
];

const event = (title: string, start: number, end: number) => ({
	allDay: false,
	calendarId: "primary",
	color: "#4593f8",
	end: new Date(end).toISOString(),
	htmlLink: null,
	id: title,
	location: null,
	start: new Date(start).toISOString(),
	title,
});

const NOW = Date.parse("2026-11-10T14:20:00+09:00");
const MINUTE = 60_000;

describe("parseTimerText", () => {
	it("takes the project out of the description", () => {
		expect(parseTimerText("論文を読む #研究", projects)).toEqual({
			description: "論文を読む",
			projectId: "lab",
		});
	});

	it("keeps unknown #words and uses the last project", () => {
		expect(parseTimerText("#仕事 #未定 メール #研究", projects)).toEqual({
			description: "#未定 メール",
			projectId: "lab",
		});
	});

	it("ignores # inside a word", () => {
		expect(parseTimerText("C#研究", projects)).toEqual({
			description: "C#研究",
			projectId: null,
		});
		expect(findHashTokens("C#研究", projects)).toEqual([]);
	});
});

describe("projects the text alone cannot name", () => {
	const all = [
		...projects,
		makeProject({ id: "side", name: "Side project" }),
		makeProject({ id: "club-lab", name: "研究", parentId: "club" }),
	];

	it("reads a project whose name has spaces as one token", () => {
		expect(parseTimerText("下書き #side project あとで", all)).toEqual({
			description: "下書き あとで",
			projectId: "side",
		});
		expect(findHashTokens("#Side projects", all)).toEqual([
			{ end: 5, project: null, start: 0 },
		]);
	});

	it("takes the picked project when several share the name", () => {
		expect(parseTimerText("論文 #研究", all).projectId).toBe("lab");
		expect(parseTimerText("論文 #研究", all, "club-lab").projectId).toBe(
			"club-lab"
		);
		// The picked project no longer counts once another name is typed.
		expect(parseTimerText("論文 #仕事", all, "club-lab").projectId).toBe(
			"work"
		);
	});
});

describe("hashAtCaret and completeHash", () => {
	it("finds the #word being typed and completes it", () => {
		const text = "会議 #仕 あと";
		const token = hashAtCaret(text, 5);
		expect(token).toEqual({ end: 5, query: "仕", start: 3 });
		expect(completeHash(text, token ?? { end: 0, start: 0 }, work)).toEqual({
			caret: 7,
			text: "会議 #仕事 あと",
		});
	});

	it("is null outside a #word", () => {
		expect(hashAtCaret("会議 #仕事 ", 7)).toBeNull();
	});
});

describe("suggestTimer", () => {
	const base = {
		entries: [],
		events: [],
		now: NOW,
		projects,
		tasks: [],
	};

	it("offers open projects while a #word is typed", () => {
		const items = suggestTimer({ ...base, caret: 3, text: "#研" });
		expect(items.map((item) => item.projectId)).toEqual(["lab"]);
	});

	it("offers events around now and recent entries for an empty box", () => {
		const items = suggestTimer({
			...base,
			caret: 0,
			entries: [
				{
					billable: true,
					description: "論文を読む",
					endedAt: NOW - 60 * MINUTE,
					id: "e1",
					projectId: "lab",
					startedAt: NOW - 120 * MINUTE,
					taskId: null,
				},
			],
			events: [
				event("ゼミ発表", NOW + 40 * MINUTE, NOW + 90 * MINUTE),
				event("昼食", NOW - 200 * MINUTE, NOW - 140 * MINUTE),
				event("夕食", NOW + 300 * MINUTE, NOW + 330 * MINUTE),
			],
			text: "",
		});
		expect(items.map((item) => [item.kind, item.description])).toEqual([
			["event", "ゼミ発表"],
			["entry", "論文を読む"],
		]);
		expect(items[0]?.note).toBe("15:00 から");
	});

	it("matches tasks before past entries, once per text", () => {
		const items = suggestTimer({
			...base,
			caret: 4,
			entries: [
				{
					billable: true,
					description: "週次レポートを送る",
					endedAt: NOW - MINUTE,
					id: "e1",
					projectId: "work",
					startedAt: NOW - 30 * MINUTE,
					taskId: null,
				},
			],
			tasks: [
				makeTask({ id: "t1", projectId: "work", title: "週次レポートを送る" }),
			],
			text: "レポート",
		});
		expect(items.map((item) => [item.kind, item.taskId])).toEqual([
			["task", "t1"],
		]);
	});
});

describe("unrecordedEvent", () => {
	const entry = (
		description: string,
		startedAt: number,
		endedAt: number,
		projectId: string | null = null
	) => ({
		billable: true,
		description,
		endedAt,
		id: `${description}-${startedAt}`,
		projectId,
		startedAt,
		taskId: null,
	});
	const seminar = event("ゼミ", NOW - 20 * MINUTE, NOW + 70 * MINUTE);

	it("offers the event under way from its start, on its last project", () => {
		const found = unrecordedEvent({
			entries: [
				entry(
					"ゼミ",
					NOW - 7 * 24 * 60 * MINUTE,
					NOW - 7 * 24 * 60 * MINUTE + MINUTE,
					"lab"
				),
			],
			events: [event("昼食", NOW - 200 * MINUTE, NOW - 140 * MINUTE), seminar],
			now: NOW,
		});
		expect(found).toEqual({
			event: seminar,
			from: NOW - 20 * MINUTE,
			projectId: "lab",
		});
	});

	it("starts after a short overlap and skips recorded events", () => {
		expect(
			unrecordedEvent({
				entries: [entry("メール", NOW - 40 * MINUTE, NOW - 15 * MINUTE)],
				events: [seminar],
				now: NOW,
			})?.from
		).toBe(NOW - 15 * MINUTE);
		expect(
			unrecordedEvent({
				entries: [entry("メール", NOW - 20 * MINUTE, NOW - 5 * MINUTE)],
				events: [seminar],
				now: NOW,
			})
		).toBeNull();
		expect(
			unrecordedEvent({
				entries: [entry("ゼミ", NOW - 3 * MINUTE, NOW - MINUTE)],
				events: [seminar],
				now: NOW,
			})
		).toBeNull();
	});
});
