import { describe, expect, it, vi } from "vitest";

import { createGoogleCalendarClient } from "../google/calendar";

describe("createGoogleCalendarClient", () => {
	it("follows page tokens for calendars and events", async () => {
		const fetchMock = vi.fn((input: RequestInfo | URL) => {
			const url = new URL(String(input));
			const page = url.searchParams.get("pageToken");
			if (url.pathname.endsWith("/calendarList")) {
				return Promise.resolve(
					Response.json(
						page
							? {
									items: [
										{ id: "b", summaryOverride: "B override", summary: "B" },
									],
								}
							: { items: [{ id: "a" }], nextPageToken: "p2" }
					)
				);
			}
			return Promise.resolve(
				Response.json(
					page
						? { items: [{ id: "e2", start: {}, end: {} }] }
						: {
								items: [
									{
										colorId: "11",
										id: "e1",
										start: { date: "2026-11-05" },
										end: { date: "2026-11-06" },
									},
								],
								nextPageToken: "p2",
							}
				)
			);
		});
		const client = createGoogleCalendarClient("t", fetchMock);

		const calendars = await client.listCalendars();
		const events = await client.listEvents("a/b", {
			timeMin: "2026-11-05T00:00:00Z",
			timeMax: "2026-11-06T00:00:00Z",
		});

		expect(calendars.map((c) => c.name)).toEqual(["a", "B override"]);
		expect(events.map((e) => [e.id, e.title, e.allDay, e.color])).toEqual([
			["e1", "", true, "#d50000"],
		]);
		expect(String(fetchMock.mock.calls[2]?.[0])).toContain(
			"/calendars/a%2Fb/events"
		);
	});
});
