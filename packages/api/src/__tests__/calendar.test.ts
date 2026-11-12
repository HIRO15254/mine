import { describe, expect, it, vi } from "vitest";

import type { FetchLike } from "../google/calendar";
import { createTestApp } from "../testing";

const EVENTS_PATH = /\/calendars\/([^/]+)\/events$/;

const calendarList = {
	items: [
		{
			id: "holidays",
			summary: "日本の祝日",
			backgroundColor: "#16a765",
			selected: true,
		},
		{
			id: "me@example.com",
			summary: "me@example.com",
			backgroundColor: "#9fe1e7",
			primary: true,
			selected: true,
		},
		{ id: "hidden", summary: "Hidden", selected: false },
	],
};

const eventsByCalendar: Record<string, unknown> = {
	"me@example.com": {
		items: [
			{
				id: "e1",
				summary: "打ち合わせ",
				start: { dateTime: "2026-11-05T10:00:00+09:00" },
				end: { dateTime: "2026-11-05T11:00:00+09:00" },
				htmlLink: "https://calendar.google.com/e1",
			},
			{
				id: "e2",
				status: "cancelled",
				start: { dateTime: "2026-11-05T12:00:00+09:00" },
				end: { dateTime: "2026-11-05T13:00:00+09:00" },
			},
		],
	},
	holidays: {
		items: [
			{
				id: "h1",
				summary: "文化の日",
				start: { date: "2026-11-03" },
				end: { date: "2026-11-04" },
			},
		],
	},
};

function googleFetch(overrides: { status?: number; body?: string } = {}) {
	return vi.fn((input: RequestInfo | URL, _init?: RequestInit) => {
		if (overrides.status) {
			return Promise.resolve(
				new Response(overrides.body ?? "", { status: overrides.status })
			);
		}
		const url = new URL(String(input));
		if (url.pathname.endsWith("/users/me/calendarList")) {
			return Promise.resolve(Response.json(calendarList));
		}
		const match = url.pathname.match(EVENTS_PATH);
		const id = decodeURIComponent(match?.[1] ?? "");
		return Promise.resolve(Response.json(eventsByCalendar[id] ?? {}));
	});
}

async function callerWith(options: {
	fetch?: FetchLike;
	token?: string | null;
}) {
	const app = await createTestApp({
		fetch: options.fetch,
		getGoogleAccessToken: () =>
			Promise.resolve(options.token === undefined ? "token" : options.token),
	});
	return app.caller;
}

const range = {
	timeMin: "2026-11-01T00:00:00+09:00",
	timeMax: "2026-11-08T00:00:00+09:00",
};

describe("calendar.calendars", () => {
	it("lists calendars with the primary first and Google's selection as default", async () => {
		const caller = await callerWith({ fetch: googleFetch() });

		await expect(caller.calendar.calendars()).resolves.toEqual([
			{
				color: "#9fe1e7",
				id: "me@example.com",
				name: "me@example.com",
				primary: true,
				visible: true,
			},
			{
				color: "#16a765",
				id: "holidays",
				name: "日本の祝日",
				primary: false,
				visible: true,
			},
			{
				color: "#4285f4",
				id: "hidden",
				name: "Hidden",
				primary: false,
				visible: false,
			},
		]);
	});

	it("sends the access token to Google", async () => {
		const fetchMock = googleFetch();
		const caller = await callerWith({ fetch: fetchMock, token: "abc" });

		await caller.calendar.calendars();

		expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
			headers: { Authorization: "Bearer abc" },
		});
	});

	it("reports a missing Google connection", async () => {
		const caller = await callerWith({ fetch: googleFetch(), token: null });

		await expect(caller.calendar.calendars()).rejects.toMatchObject({
			code: "PRECONDITION_FAILED",
			message: "GOOGLE_CALENDAR_NOT_CONNECTED",
		});
	});

	it("reports a token without the calendar scope", async () => {
		const caller = await callerWith({
			fetch: googleFetch({
				status: 403,
				body: '{"error":{"status":"PERMISSION_DENIED","message":"Request had insufficient authentication scopes."}}',
			}),
		});

		await expect(caller.calendar.calendars()).rejects.toMatchObject({
			code: "PRECONDITION_FAILED",
		});
	});

	it("reports a revoked token", async () => {
		const caller = await callerWith({ fetch: googleFetch({ status: 401 }) });

		await expect(caller.calendar.calendars()).rejects.toMatchObject({
			code: "PRECONDITION_FAILED",
		});
	});

	it("surfaces other Google failures as server errors", async () => {
		const caller = await callerWith({ fetch: googleFetch({ status: 500 }) });

		await expect(caller.calendar.calendars()).rejects.toMatchObject({
			code: "INTERNAL_SERVER_ERROR",
		});
	});

	it("does not treat a rate limit as a missing connection", async () => {
		const caller = await callerWith({
			fetch: googleFetch({ status: 403, body: "rateLimitExceeded" }),
		});

		await expect(caller.calendar.calendars()).rejects.toMatchObject({
			code: "INTERNAL_SERVER_ERROR",
		});
	});
});

describe("calendar.setVisibility", () => {
	it("overrides Google's selection and can be changed again", async () => {
		const caller = await callerWith({ fetch: googleFetch() });

		await caller.calendar.setVisibility({
			calendarId: "holidays",
			visible: false,
		});
		await caller.calendar.setVisibility({
			calendarId: "hidden",
			visible: true,
		});
		await caller.calendar.setVisibility({
			calendarId: "hidden",
			visible: false,
		});
		await caller.calendar.setVisibility({
			calendarId: "hidden",
			visible: true,
		});

		const calendars = await caller.calendar.calendars();
		expect(Object.fromEntries(calendars.map((c) => [c.id, c.visible]))).toEqual(
			{ holidays: false, hidden: true, "me@example.com": true }
		);
	});
});

describe("calendar.events", () => {
	it("merges events from visible calendars and drops cancelled ones", async () => {
		const fetchMock = googleFetch();
		const caller = await callerWith({ fetch: fetchMock });

		const result = await caller.calendar.events(range);

		expect(result.calendars.map((c) => c.id)).toEqual([
			"me@example.com",
			"holidays",
		]);
		expect(result.events).toEqual([
			{
				allDay: false,
				calendarId: "me@example.com",
				color: "#9fe1e7",
				end: "2026-11-05T11:00:00+09:00",
				htmlLink: "https://calendar.google.com/e1",
				id: "e1",
				location: null,
				start: "2026-11-05T10:00:00+09:00",
				title: "打ち合わせ",
			},
			{
				allDay: true,
				calendarId: "holidays",
				color: "#16a765",
				end: "2026-11-04",
				htmlLink: null,
				id: "h1",
				location: null,
				start: "2026-11-03",
				title: "文化の日",
			},
		]);
		const eventUrl = new URL(String(fetchMock.mock.calls[1]?.[0]));
		expect(Object.fromEntries(eventUrl.searchParams)).toMatchObject({
			singleEvents: "true",
			orderBy: "startTime",
			timeMin: range.timeMin,
			timeMax: range.timeMax,
		});
	});

	it("rejects an inverted or overly long range", async () => {
		const caller = await callerWith({ fetch: googleFetch() });

		await expect(
			caller.calendar.events({ timeMin: range.timeMax, timeMax: range.timeMin })
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
		await expect(
			caller.calendar.events({
				timeMin: "2026-01-01T00:00:00Z",
				timeMax: "2026-06-01T00:00:00Z",
			})
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
	});
});
