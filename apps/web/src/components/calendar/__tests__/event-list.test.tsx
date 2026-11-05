import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { DisplayEvent } from "@/lib/calendar-time";

import { EventList } from "../event-list";

const day = new Date(2026, 10, 5);
const EVENT_NAME = /文化祭/;

const base: DisplayEvent = {
	allDay: true,
	calendarId: "c",
	color: "#16a765",
	end: "2026-11-06",
	htmlLink: "https://calendar.google.com/event?eid=1",
	id: "e1",
	location: "会議室A",
	start: "2026-11-05",
	title: "文化祭",
};

describe("EventList", () => {
	it("shows an empty label", () => {
		render(<EventList day={day} emptyLabel="なし" events={[]} />);
		expect(screen.getByText("なし")).toBeInTheDocument();
	});

	it("links events to Google Calendar", () => {
		render(
			<EventList
				day={day}
				events={[
					base,
					{ ...base, id: "e2", title: "", htmlLink: null, location: null },
				]}
			/>
		);

		const link = screen.getByRole("link", { name: EVENT_NAME });
		expect(link).toHaveAttribute("href", base.htmlLink);
		expect(link).toHaveAttribute("target", "_blank");
		expect(link).toHaveTextContent("終日");
		expect(link).toHaveTextContent("会議室A");
		expect(screen.getByText("（タイトルなし）")).toBeInTheDocument();
		expect(screen.getAllByRole("link")).toHaveLength(1);
	});
});
