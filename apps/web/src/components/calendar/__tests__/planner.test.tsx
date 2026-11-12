import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { signInSocial } = vi.hoisted(() => ({
	signInSocial: vi.fn(() => Promise.resolve({ error: null })),
}));
vi.mock("@/lib/auth-client", () => ({
	authClient: { signIn: { social: signInSocial } },
}));
vi.mock("@/lib/trpc", () => import("../../../__tests__/test-api"));

import { addDays, monthGridDays, startOfWeek } from "@/lib/calendar-time";
import { freezeNow, NOW } from "../../../__tests__/clock";
import { renderWithQuery, useDesktopLayout } from "../../../__tests__/render";
import { api } from "../../../__tests__/test-api";
import { useEventEditor } from "../event-editor";
import { CalendarPlanner, type CalendarView } from "../planner";

const TODAY = new Date(NOW);
const WEEK = Array.from({ length: 7 }, (_, index) =>
	addDays(startOfWeek(TODAY), index)
);
const MONTH = new Date(2026, 10, 1);
const HOUR_PX = 48;
const MINUTE = 60_000;
const MEETING = /研究室ミーティング/;
const TWO_AND_A_HALF_HOURS = /2時間30分/;

const calendar = {
	color: "#4593f8",
	id: "primary",
	name: "マイカレンダー",
	primary: true,
	visible: true,
	writable: true,
};

const meeting = {
	allDay: false,
	calendarId: "primary",
	color: "#4593f8",
	description: null,
	end: "2026-11-11T11:00:00+09:00",
	htmlLink: "https://calendar.google.com/meeting",
	id: "meeting",
	location: null,
	recurring: false,
	start: "2026-11-11T10:00:00+09:00",
	title: "研究室ミーティング",
};

function stubGoogle(events = [meeting]) {
	api.stub("calendar.calendars", () => [calendar]);
	api.stub("calendar.events", () => ({ calendars: [calendar], events }));
}

function Planner({
	onPickDay = () => undefined,
	view = "week",
}: {
	onPickDay?: (day: Date) => void;
	view?: CalendarView;
}) {
	const eventEditor = useEventEditor();
	return (
		<>
			<CalendarPlanner
				days={view === "month" ? monthGridDays(MONTH) : WEEK}
				eventEditor={eventEditor}
				month={view === "month" ? MONTH : null}
				onPickDay={onPickDay}
				today={TODAY}
				view={view}
			/>
			{eventEditor.editor}
		</>
	);
}

const tray = () =>
	screen.getByRole("region", { name: "時間が決まっていないタスク" });

const hourOf = () =>
	(
		document.querySelector("[data-slot=time-grid]") as HTMLElement
	).style.getPropertyValue("--hour");

function usePhoneLayout() {
	window.matchMedia = ((query: string) => ({
		addEventListener: () => undefined,
		addListener: () => undefined,
		matches: false,
		media: query,
		removeEventListener: () => undefined,
		removeListener: () => undefined,
	})) as unknown as typeof window.matchMedia;
}

beforeEach(async () => {
	await api.reset();
	freezeNow();
	useDesktopLayout();
	window.localStorage.clear();
});

describe("the tray", () => {
	it("lists the tasks of the week on screen until every task is asked for", async () => {
		await api.caller.task.create({
			deadline: "2026-11-13",
			title: "今週締め切り",
		});
		await api.caller.task.create({
			deadline: "2026-12-20",
			title: "来月締め切り",
		});
		await api.caller.task.create({
			scheduledDate: "2026-11-12",
			title: "木曜にやる",
		});
		stubGoogle([]);
		renderWithQuery(<Planner />);

		expect(await within(tray()).findByText("今週締め切り")).toBeVisible();
		expect(within(tray()).queryByText("来月締め切り")).not.toBeInTheDocument();
		// Planned for a day on screen: in that day's 終日 row, not the tray.
		expect(within(tray()).queryByText("木曜にやる")).not.toBeInTheDocument();
		expect(screen.getByText("木曜にやる")).toBeVisible();

		await userEvent.click(within(tray()).getByText("すべて"));

		expect(await within(tray()).findByText("来月締め切り")).toBeVisible();
	});

	it("names the month in the month view", async () => {
		await api.caller.task.create({
			deadline: "2026-11-28",
			title: "月末締め切り",
		});
		stubGoogle([]);
		renderWithQuery(<Planner view="month" />);

		expect(await within(tray()).findByText("月末締め切り")).toBeVisible();
		expect(within(tray()).getByText("この月")).toBeVisible();
	});
});

describe("events", () => {
	it("adds an event at the half hour clicked on the empty grid", async () => {
		stubGoogle([]);
		api.stub("calendar.createEvent", (input) => ({
			...meeting,
			id: "new",
			title: input.title,
		}));
		renderWithQuery(<Planner />);

		fireEvent.click(
			await screen.findByRole("button", { name: "11月10日(火)に予定を追加" }),
			// 13:37 on the grid, which starts the event at 13:30.
			{ clientY: HOUR_PX * 13 + 30 }
		);
		await userEvent.type(await screen.findByLabelText("タイトル"), "面談");
		await userEvent.click(screen.getByRole("button", { name: "保存" }));

		await waitFor(() =>
			expect(api.calls("calendar.createEvent")).toEqual([
				{
					calendarId: "primary",
					description: null,
					location: null,
					title: "面談",
					when: {
						allDay: false,
						end: new Date(
							Date.parse("2026-11-10T14:30:00+09:00")
						).toISOString(),
						start: new Date(
							Date.parse("2026-11-10T13:30:00+09:00")
						).toISOString(),
						timeZone: expect.any(String),
					},
				},
			])
		);
	});

	it("changes an event of a calendar the person can edit", async () => {
		stubGoogle();
		api.stub("calendar.updateEvent", (input) => ({
			...meeting,
			title: input.title ?? meeting.title,
		}));
		renderWithQuery(<Planner />);

		await userEvent.click(await screen.findByRole("button", { name: MEETING }));
		const title = await screen.findByLabelText("タイトル");
		expect(screen.getByRole("link", { name: "Google で開く" })).toHaveAttribute(
			"href",
			meeting.htmlLink
		);
		await userEvent.clear(title);
		await userEvent.type(title, "研究室ミーティング（延長）");
		await userEvent.click(screen.getByRole("button", { name: "保存" }));

		await waitFor(() =>
			expect(api.calls("calendar.updateEvent")).toMatchObject([
				{
					calendarId: "primary",
					eventId: "meeting",
					title: "研究室ミーティング（延長）",
				},
			])
		);
	});

	it("opens an event of a read-only calendar in Google instead", async () => {
		api.stub("calendar.calendars", () => [{ ...calendar, writable: false }]);
		api.stub("calendar.events", () => ({
			calendars: [{ ...calendar, writable: false }],
			events: [meeting],
		}));
		renderWithQuery(<Planner />);

		const link = await screen.findByRole("link", {
			name: MEETING,
		});
		expect(link).toHaveAttribute("href", meeting.htmlLink);
	});

	it("says how to fix a token from before events could be written", async () => {
		stubGoogle([]);
		api.stub("calendar.createEvent", () => {
			throw new Error("GOOGLE_CALENDAR_NOT_CONNECTED");
		});
		renderWithQuery(<Planner />);

		fireEvent.click(
			await screen.findByRole("button", {
				name: "11月10日(火)に終日の予定を追加",
			})
		);
		await userEvent.type(await screen.findByLabelText("タイトル"), "旅行");
		await userEvent.click(screen.getByRole("button", { name: "保存" }));

		expect(
			await screen.findByText(
				"予定を編集するには、Google カレンダーとの連携をやり直してください"
			)
		).toBeVisible();
		await userEvent.click(screen.getByRole("button", { name: "連携し直す" }));
		expect(signInSocial).toHaveBeenCalledWith(
			expect.objectContaining({ provider: "google" })
		);
	});
});

describe("the time rail", () => {
	it("shows what was recorded when its line is tapped", async () => {
		const project = await api.caller.project.create({
			color: "chart-2",
			name: "研究",
		});
		await api.caller.time.create({
			description: "実験データの整理",
			endedAt: NOW - 120 * MINUTE,
			projectId: project.id,
			startedAt: NOW - 270 * MINUTE,
		});
		stubGoogle([]);
		renderWithQuery(<Planner />);

		await userEvent.click(
			await screen.findByRole("button", {
				name: "実験データの整理 09:50–12:20",
			})
		);

		const card = screen.getByRole("dialog", { name: "時間の記録" });
		expect(within(card).getByText("研究")).toBeVisible();
		expect(within(card).getByText(TWO_AND_A_HALF_HOURS)).toBeVisible();
		// The hours are their own stack, so the rail cannot rise above the
		// sticky day and 終日 rows or the page header.
		expect(card.closest("[data-slot=time-grid-hours]")).toHaveClass("isolate");
	});
});

describe("the time scale", () => {
	it("zooms the hours with its buttons and keeps the scale for the next visit", async () => {
		stubGoogle([]);
		const first = renderWithQuery(<Planner />);
		expect(hourOf()).toBe(`${HOUR_PX}px`);

		await userEvent.click(
			screen.getByRole("button", { name: "時間の縮尺を拡大" })
		);
		expect(hourOf()).toBe("56px");
		first.unmount();

		renderWithQuery(<Planner />);
		expect(hourOf()).toBe("56px");
	});

	it("stops at the smallest scale", async () => {
		stubGoogle([]);
		renderWithQuery(<Planner />);
		const zoomOut = screen.getByRole("button", { name: "時間の縮尺を縮小" });

		await userEvent.click(zoomOut);
		expect(hourOf()).toBe("40px");
		expect(zoomOut).toBeDisabled();

		// Nor does the wheel go below it.
		const hours = document.querySelector(
			"[data-slot=time-grid-hours]"
		) as HTMLElement;
		fireEvent.wheel(hours, { ctrlKey: true, deltaY: 500 });
		expect(hourOf()).toBe("40px");
	});

	it("raises a scale saved below the smallest", () => {
		window.localStorage.setItem(
			"mine-calendar-hour",
			JSON.stringify({ desk: 24 })
		);
		stubGoogle([]);
		renderWithQuery(<Planner />);

		expect(hourOf()).toBe("40px");
	});

	it("zooms with ctrl and the wheel", () => {
		stubGoogle([]);
		renderWithQuery(<Planner />);
		const hours = document.querySelector(
			"[data-slot=time-grid-hours]"
		) as HTMLElement;

		fireEvent.wheel(hours, { ctrlKey: true, deltaY: -50 });

		expect(Number.parseFloat(hourOf())).toBeGreaterThan(HOUR_PX);
	});
});

describe("the editors", () => {
	it("keeps the task and the record editors apart", async () => {
		const error = vi
			.spyOn(console, "error")
			.mockImplementation(() => undefined);
		stubGoogle([]);
		renderWithQuery(<Planner />);
		await screen.findByRole("region", { name: "時間が決まっていないタスク" });

		const duplicateKeys = error.mock.calls.filter((call) =>
			String(call[0]).includes("same key")
		);
		error.mockRestore();
		expect(duplicateKeys).toEqual([]);
	});
});

describe("the phone's week", () => {
	it("keeps the day picker with the tray under the header", () => {
		usePhoneLayout();
		stubGoogle([]);
		renderWithQuery(<Planner />);

		const strip = document.querySelector("[data-slot=day-strip]");
		// It cancels the page's top padding, so the space above the days is the
		// same before and after it sticks.
		expect(strip).toHaveClass("sticky", "-mt-3.5");
		expect(within(strip as HTMLElement).getByRole("tablist")).toBeVisible();
		expect(strip).toContainElement(tray());
	});
});

describe("the month view", () => {
	it("shows each day's events and opens a day's week", async () => {
		stubGoogle();
		const onPickDay = vi.fn();
		renderWithQuery(<Planner onPickDay={onPickDay} view="month" />);

		expect(await screen.findByRole("button", { name: MEETING })).toBeVisible();
		await userEvent.click(
			screen.getByRole("button", { name: "11月20日(金)の週を開く" })
		);

		expect(onPickDay).toHaveBeenCalledWith(new Date(2026, 10, 20));
	});
});
