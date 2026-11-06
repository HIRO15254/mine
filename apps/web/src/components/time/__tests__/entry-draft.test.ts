import { describe, expect, it } from "vitest";

import { draftFromEntry, draftTimes } from "../entry-draft";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const NOV5_9AM = new Date(2026, 10, 5, 9).getTime();

describe("entry drafts", () => {
	it("defaults a new entry to the last half hour", () => {
		expect(
			draftFromEntry(null, NOV5_9AM + 7 * MINUTE, { projectId: "p" })
		).toEqual({
			billable: true,
			day: "2026-11-05",
			description: "",
			end: "09:05",
			projectId: "p",
			running: false,
			start: "08:35",
		});
	});

	it("reads an existing entry", () => {
		const draft = draftFromEntry(
			{
				billable: false,
				description: "会議",
				endedAt: null,
				id: "e",
				projectId: null,
				startedAt: NOV5_9AM,
				taskId: null,
			},
			NOV5_9AM
		);
		expect(draft).toMatchObject({
			billable: false,
			end: "",
			projectId: "",
			running: true,
			start: "09:00",
		});
	});

	it("turns the form into times", () => {
		const base = draftFromEntry(null, NOV5_9AM);
		expect(
			draftTimes({ ...base, end: "10:30", start: "09:00" }, NOV5_9AM)
		).toEqual({ endedAt: NOV5_9AM + 1.5 * HOUR, startedAt: NOV5_9AM });
		expect(
			draftTimes({ ...base, end: "01:00", start: "23:00" }, NOV5_9AM)
		).toEqual({
			endedAt: NOV5_9AM + 16 * HOUR,
			startedAt: NOV5_9AM + 14 * HOUR,
		});
		expect(draftTimes({ ...base, start: "" }, NOV5_9AM)).toEqual({
			error: "開始の日時を入力してください",
		});
		expect(draftTimes({ ...base, end: "" }, NOV5_9AM)).toEqual({
			error: "終了の時刻を入力してください",
		});
		expect(
			draftTimes({ ...base, running: true, start: "10:00" }, NOV5_9AM)
		).toEqual({ error: "開始を未来にはできません" });
		expect(
			draftTimes({ ...base, running: true, start: "08:00" }, NOV5_9AM)
		).toEqual({ endedAt: null, startedAt: NOV5_9AM - HOUR });
	});
});
