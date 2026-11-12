import { describe, expect, it } from "vitest";

import type { DisplayEvent } from "@/lib/calendar-time";

import {
	daysBetween,
	draftFromEvent,
	eventFields,
	movedTo,
	moveStart,
	shiftedByDays,
} from "../event-draft";

const seed = { allDay: false, calendarId: "primary", day: "2026-11-10" };

const event = (extra: Partial<DisplayEvent> = {}): DisplayEvent => ({
	allDay: false,
	calendarId: "primary",
	color: "#4593f8",
	description: null,
	end: "2026-11-10T11:30:00+09:00",
	htmlLink: null,
	id: "e1",
	location: null,
	recurring: false,
	start: "2026-11-10T10:00:00+09:00",
	title: "ゼミ",
	...extra,
});

describe("draftFromEvent", () => {
	it("starts a new event at the picked minute for an hour", () => {
		expect(draftFromEvent(null, { ...seed, minutes: 13 * 60 + 30 })).toEqual({
			allDay: false,
			calendarId: "primary",
			description: "",
			endDay: "2026-11-10",
			endTime: "14:30",
			location: "",
			startDay: "2026-11-10",
			startTime: "13:30",
			title: "",
		});
	});

	it("keeps a new event late in the evening on its day", () => {
		expect(
			draftFromEvent(null, { ...seed, minutes: 23 * 60 + 30 }).endTime
		).toBe("23:59");
	});

	it("reads a timed event in local time", () => {
		expect(draftFromEvent(event({ location: "研究室" }), seed)).toMatchObject({
			endDay: "2026-11-10",
			endTime: "11:30",
			location: "研究室",
			startTime: "10:00",
			title: "ゼミ",
		});
	});

	it("shows an all-day event's last day, not Google's exclusive end", () => {
		const draft = draftFromEvent(
			event({ allDay: true, end: "2026-11-12", start: "2026-11-10" }),
			seed
		);
		expect(draft).toMatchObject({
			allDay: true,
			endDay: "2026-11-11",
			startDay: "2026-11-10",
		});
	});
});

describe("moveStart", () => {
	it("moves the end along so a timed event keeps its length", () => {
		const draft = draftFromEvent(event(), seed);
		expect(moveStart(draft, { startTime: "23:00" })).toMatchObject({
			endDay: "2026-11-11",
			endTime: "00:30",
			startTime: "23:00",
		});
	});

	it("moves the last day of an all-day event with its first", () => {
		const draft = draftFromEvent(
			event({ allDay: true, end: "2026-11-12", start: "2026-11-10" }),
			seed
		);
		expect(moveStart(draft, { startDay: "2026-11-20" })).toMatchObject({
			endDay: "2026-11-21",
			startDay: "2026-11-20",
		});
	});
});

describe("eventFields", () => {
	it("sends a timed event as instants with the time zone", () => {
		const draft = { ...draftFromEvent(event(), seed), title: "  ゼミ " };
		expect(eventFields(draft, "Asia/Tokyo")).toEqual({
			description: null,
			location: null,
			title: "ゼミ",
			when: {
				allDay: false,
				end: "2026-11-10T02:30:00.000Z",
				start: "2026-11-10T01:00:00.000Z",
				timeZone: "Asia/Tokyo",
			},
		});
	});

	it("sends an all-day event with the day after its last", () => {
		const draft = {
			...draftFromEvent(null, { ...seed, allDay: true }),
			title: "旅行",
		};
		expect(eventFields(draft, "Asia/Tokyo")).toMatchObject({
			when: { allDay: true, end: "2026-11-11", start: "2026-11-10" },
		});
	});

	it("says what is missing or the wrong way round", () => {
		const draft = draftFromEvent(null, seed);
		expect(eventFields(draft, "Asia/Tokyo")).toEqual({
			error: "タイトルを入力してください",
		});
		expect(
			eventFields({ ...draft, endTime: "08:00", title: "x" }, "Asia/Tokyo")
		).toEqual({ error: "終了を開始より後にしてください" });
		expect(
			eventFields(
				{ ...draft, allDay: true, endDay: "2026-11-09", title: "x" },
				"Asia/Tokyo"
			)
		).toEqual({ error: "終了日を開始日より後にしてください" });
	});
});

describe("moving events", () => {
	it("moves a timed event to a time on another day, keeping its length", () => {
		expect(
			movedTo(event(), new Date(2026, 10, 12), 15 * 60, "Asia/Tokyo")
		).toEqual({
			allDay: false,
			end: "2026-11-12T07:30:00.000Z",
			start: "2026-11-12T06:00:00.000Z",
			timeZone: "Asia/Tokyo",
		});
	});

	it("shifts timed and all-day events by whole days", () => {
		expect(shiftedByDays(event(), 2, "Asia/Tokyo")).toMatchObject({
			start: "2026-11-12T01:00:00.000Z",
		});
		expect(
			shiftedByDays(
				event({ allDay: true, end: "2026-11-11", start: "2026-11-10" }),
				-1,
				"Asia/Tokyo"
			)
		).toEqual({ allDay: true, end: "2026-11-10", start: "2026-11-09" });
		expect(daysBetween("2026-10-30", "2026-11-02")).toBe(3);
	});
});
