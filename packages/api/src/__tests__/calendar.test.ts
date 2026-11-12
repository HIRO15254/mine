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
			accessRole: "reader",
		},
		{
			id: "me@example.com",
			summary: "me@example.com",
			backgroundColor: "#9fe1e7",
			primary: true,
			selected: true,
			accessRole: "owner",
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
				description: "議題",
				recurringEventId: "weekly",
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
				writable: true,
			},
			{
				color: "#16a765",
				id: "holidays",
				name: "日本の祝日",
				primary: false,
				visible: true,
				writable: false,
			},
			{
				color: "#4285f4",
				id: "hidden",
				name: "Hidden",
				primary: false,
				visible: false,
				writable: false,
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

		expect(result.calendars).toEqual([
			{
				color: "#9fe1e7",
				id: "me@example.com",
				name: "me@example.com",
				writable: true,
			},
			{ color: "#16a765", id: "holidays", name: "日本の祝日", writable: false },
		]);
		expect(result.events).toEqual([
			{
				allDay: false,
				calendarId: "me@example.com",
				color: "#9fe1e7",
				description: "議題",
				end: "2026-11-05T11:00:00+09:00",
				htmlLink: "https://calendar.google.com/e1",
				id: "e1",
				location: null,
				recurring: true,
				start: "2026-11-05T10:00:00+09:00",
				title: "打ち合わせ",
			},
			{
				allDay: true,
				calendarId: "holidays",
				color: "#16a765",
				description: null,
				end: "2026-11-04",
				htmlLink: null,
				id: "h1",
				location: null,
				recurring: false,
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

/** Answers event writes like Google does, and records what was sent. */
function writeFetch(answer: { status?: number; body?: string } = {}) {
	return vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
		if (answer.status) {
			return Promise.resolve(
				new Response(answer.body ?? "", { status: answer.status })
			);
		}
		if (init?.method === "DELETE") {
			return Promise.resolve(new Response(null, { status: 204 }));
		}
		const body = JSON.parse(String(init?.body ?? "{}"));
		return Promise.resolve(
			Response.json({
				id: String(input).split("/events/")[1] ?? "new-event",
				htmlLink: "https://calendar.google.com/new",
				summary: body.summary ?? "既存",
				location: body.location,
				description: body.description,
				start: body.start ?? { dateTime: "2026-11-05T10:00:00+09:00" },
				end: body.end ?? { dateTime: "2026-11-05T11:00:00+09:00" },
			})
		);
	});
}

function sent(fetchMock: ReturnType<typeof writeFetch>, index = 0) {
	const [input, init] = fetchMock.mock.calls[index] ?? [];
	return {
		body: init?.body ? JSON.parse(String(init.body)) : undefined,
		method: init?.method,
		url: new URL(String(input)),
	};
}

const timed = {
	allDay: false as const,
	start: "2026-11-05T10:00:00+09:00",
	end: "2026-11-05T11:30:00+09:00",
	timeZone: "Asia/Tokyo",
};

describe("calendar.createEvent", () => {
	it("adds a timed event to the calendar and returns it", async () => {
		const fetchMock = writeFetch();
		const caller = await callerWith({ fetch: fetchMock });

		const event = await caller.calendar.createEvent({
			calendarId: "me@example.com",
			location: "研究室",
			title: "  ゼミ  ",
			when: timed,
		});

		const request = sent(fetchMock);
		expect(request.method).toBe("POST");
		expect(request.url.pathname).toBe(
			"/calendar/v3/calendars/me%40example.com/events"
		);
		expect(request.body).toEqual({
			description: "",
			end: {
				date: null,
				dateTime: "2026-11-05T11:30:00+09:00",
				timeZone: "Asia/Tokyo",
			},
			location: "研究室",
			start: {
				date: null,
				dateTime: "2026-11-05T10:00:00+09:00",
				timeZone: "Asia/Tokyo",
			},
			summary: "ゼミ",
		});
		expect(event).toMatchObject({
			allDay: false,
			calendarId: "me@example.com",
			id: "new-event",
			location: "研究室",
			title: "ゼミ",
		});
	});

	it("adds an all-day event with Google's exclusive end day", async () => {
		const fetchMock = writeFetch();
		const caller = await callerWith({ fetch: fetchMock });

		const event = await caller.calendar.createEvent({
			calendarId: "me@example.com",
			title: "旅行",
			when: { allDay: true, start: "2026-11-05", end: "2026-11-07" },
		});

		expect(sent(fetchMock).body).toMatchObject({
			end: { date: "2026-11-07", dateTime: null },
			start: { date: "2026-11-05", dateTime: null },
		});
		expect(event).toMatchObject({
			allDay: true,
			end: "2026-11-07",
			start: "2026-11-05",
		});
	});

	it("refuses an end before the start, a bad time zone and an empty title", async () => {
		const fetchMock = writeFetch();
		const caller = await callerWith({ fetch: fetchMock });
		const base = { calendarId: "me@example.com", title: "x" };

		await expect(
			caller.calendar.createEvent({
				...base,
				when: { ...timed, start: timed.end, end: timed.start },
			})
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
		await expect(
			caller.calendar.createEvent({
				...base,
				when: { allDay: true, start: "2026-11-05", end: "2026-11-05" },
			})
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
		await expect(
			caller.calendar.createEvent({
				...base,
				when: { ...timed, timeZone: "Mars/Olympus" },
			})
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
		await expect(
			caller.calendar.createEvent({ ...base, title: "   ", when: timed })
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("reports a token granted before events could be written", async () => {
		const caller = await callerWith({
			fetch: writeFetch({
				status: 403,
				body: '{"error":{"message":"Request had insufficient authentication scopes."}}',
			}),
		});

		await expect(
			caller.calendar.createEvent({
				calendarId: "me@example.com",
				title: "x",
				when: timed,
			})
		).rejects.toMatchObject({
			code: "PRECONDITION_FAILED",
			message: "GOOGLE_CALENDAR_NOT_CONNECTED",
		});
	});

	it("refuses a calendar the user may only read", async () => {
		const caller = await callerWith({
			fetch: writeFetch({
				status: 403,
				body: '{"error":{"errors":[{"domain":"calendar","reason":"requiredAccessLevel"}],"code":403}}',
			}),
		});

		await expect(
			caller.calendar.createEvent({
				calendarId: "holidays",
				title: "x",
				when: timed,
			})
		).rejects.toMatchObject({ code: "FORBIDDEN" });
	});
});

describe("calendar.updateEvent", () => {
	it("patches only the fields it is given", async () => {
		const fetchMock = writeFetch();
		const caller = await callerWith({ fetch: fetchMock });

		const event = await caller.calendar.updateEvent({
			calendarId: "me@example.com",
			eventId: "e1_20261105",
			when: { allDay: true, start: "2026-11-06", end: "2026-11-07" },
		});

		const request = sent(fetchMock);
		expect(request.method).toBe("PATCH");
		expect(request.url.pathname).toBe(
			"/calendar/v3/calendars/me%40example.com/events/e1_20261105"
		);
		expect(request.body).toEqual({
			end: { date: "2026-11-07", dateTime: null },
			start: { date: "2026-11-06", dateTime: null },
		});
		expect(event).toMatchObject({ allDay: true, id: "e1_20261105" });
	});

	it("clears the location and the description when sent null", async () => {
		const fetchMock = writeFetch();
		const caller = await callerWith({ fetch: fetchMock });

		await caller.calendar.updateEvent({
			calendarId: "me@example.com",
			description: null,
			eventId: "e1",
			location: null,
			title: "新しい名前",
		});

		expect(sent(fetchMock).body).toEqual({
			description: "",
			location: "",
			summary: "新しい名前",
		});
	});

	it("reports an event that no longer exists", async () => {
		const caller = await callerWith({ fetch: writeFetch({ status: 404 }) });

		await expect(
			caller.calendar.updateEvent({
				calendarId: "me@example.com",
				eventId: "gone",
				title: "x",
			})
		).rejects.toMatchObject({ code: "NOT_FOUND" });
	});
});

describe("calendar.deleteEvent", () => {
	it("deletes the event", async () => {
		const fetchMock = writeFetch();
		const caller = await callerWith({ fetch: fetchMock });

		await expect(
			caller.calendar.deleteEvent({
				calendarId: "me@example.com",
				eventId: "e1",
			})
		).resolves.toEqual({ calendarId: "me@example.com", eventId: "e1" });
		expect(sent(fetchMock)).toMatchObject({ method: "DELETE" });
	});

	it("treats an event Google already deleted as not found", async () => {
		const caller = await callerWith({ fetch: writeFetch({ status: 410 }) });

		await expect(
			caller.calendar.deleteEvent({
				calendarId: "me@example.com",
				eventId: "e1",
			})
		).rejects.toMatchObject({ code: "NOT_FOUND" });
	});
});
