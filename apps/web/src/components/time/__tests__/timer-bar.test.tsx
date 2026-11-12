import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/trpc", () => import("../../../__tests__/test-api"));

import { freezeNow, NOW } from "../../../__tests__/clock";
import { renderWithQuery } from "../../../__tests__/render";
import { api } from "../../../__tests__/test-api";
import { TimerBar } from "../timer-bar";

const MINUTE = 60_000;
const ESTIMATE = /見積もり/;
const WORK = /仕事/;
const REPORT = /週次レポートを送る/;
const MEETING = /研究室ミーティング/;
const DOCS = /資料/;
const CAMP = /合宿の準備/;

async function seed() {
	const work = await api.caller.project.create({
		color: "chart-2",
		name: "仕事",
	});
	return { projects: await api.client.project.list.query(), work };
}

/** A calendar event around the frozen clock, as Google would return it. */
function stubEvent(id: string, title: string, startsAt: number) {
	api.stub("calendar.events", () => ({
		calendars: [],
		events: [
			{
				allDay: false,
				calendarId: "primary",
				color: "#e67c73",
				end: new Date(startsAt + 60 * MINUTE).toISOString(),
				htmlLink: null,
				id,
				location: null,
				start: new Date(startsAt).toISOString(),
				title,
			},
		],
	}));
}

describe("TimerBar", () => {
	beforeEach(async () => {
		await api.reset();
		freezeNow();
	});

	it("starts a timer with a description and a #project", async () => {
		const { projects, work } = await seed();
		const { container } = renderWithQuery(<TimerBar projects={projects} />);

		await userEvent.type(
			await screen.findByLabelText("何をしていますか"),
			"資料作り #仕事 "
		);
		expect(
			container.querySelector(`mark[data-project="${work.id}"]`)
		).toHaveTextContent("#仕事");
		await userEvent.click(screen.getByRole("button", { name: "計測を始める" }));

		await waitFor(async () =>
			expect(await api.caller.time.current()).toMatchObject({
				description: "資料作り",
				projectId: work.id,
				startedAt: NOW,
				taskId: null,
			})
		);
	});

	it("completes a #project from the suggestions", async () => {
		const { projects } = await seed();
		renderWithQuery(<TimerBar projects={projects} />);

		const input = await screen.findByLabelText("何をしていますか");
		await userEvent.type(input, "会議 #仕");
		expect(await screen.findByRole("option", { name: WORK })).toBeVisible();
		await userEvent.keyboard("{Enter}");

		expect(input).toHaveValue("会議 #仕事 ");
		expect(api.calls("time.start")).toEqual([]);
	});

	it("leaves keys to the IME while kana is being converted", async () => {
		const { projects } = await seed();
		renderWithQuery(<TimerBar projects={projects} />);

		const input = await screen.findByLabelText("何をしていますか");
		await userEvent.type(input, "会議 #仕");
		expect(await screen.findByRole("option", { name: WORK })).toBeVisible();
		// Enter that confirms the conversion must not pick the suggestion.
		fireEvent.keyDown(input, { isComposing: true, key: "Enter" });

		expect(input).toHaveValue("会議 #仕");
	});

	it("starts a suggested task with its project", async () => {
		const { projects, work } = await seed();
		const task = await api.caller.task.create({
			projectId: work.id,
			title: "週次レポートを送る",
		});
		renderWithQuery(<TimerBar projects={projects} />);

		await userEvent.type(
			await screen.findByLabelText("何をしていますか"),
			"レポート"
		);
		await userEvent.click(await screen.findByRole("option", { name: REPORT }));
		await userEvent.click(screen.getByRole("button", { name: "計測を始める" }));

		await waitFor(async () =>
			expect(await api.caller.time.current()).toMatchObject({
				description: "週次レポートを送る",
				projectId: work.id,
				taskId: task.id,
			})
		);
	});

	it("links a picked task whose title has a full-width space", async () => {
		const { projects } = await seed();
		const task = await api.caller.task.create({ title: "資料　確認" });
		renderWithQuery(<TimerBar projects={projects} />);

		await userEvent.type(
			await screen.findByLabelText("何をしていますか"),
			"資料"
		);
		await userEvent.click(await screen.findByRole("option", { name: DOCS }));
		await userEvent.click(screen.getByRole("button", { name: "計測を始める" }));

		await waitFor(() =>
			expect(api.calls("time.start")).toEqual([
				{ description: "資料 確認", projectId: null, taskId: task.id },
			])
		);
	});

	it("starts on the picked project when another has the same name", async () => {
		await api.caller.project.create({ name: "研究" });
		const club = await api.caller.project.create({ name: "サークル" });
		const clubLab = await api.caller.project.create({
			name: "研究",
			parentId: club.id,
		});
		const task = await api.caller.task.create({
			projectId: clubLab.id,
			title: "合宿の準備",
		});
		renderWithQuery(
			<TimerBar projects={await api.client.project.list.query()} />
		);

		await userEvent.type(
			await screen.findByLabelText("何をしていますか"),
			"合宿"
		);
		await userEvent.click(await screen.findByRole("option", { name: CAMP }));
		await userEvent.click(screen.getByRole("button", { name: "計測を始める" }));

		await waitFor(() =>
			expect(api.calls("time.start")).toEqual([
				{ description: "合宿の準備", projectId: clubLab.id, taskId: task.id },
			])
		);
	});

	it("gives the text back when the start fails", async () => {
		const { projects } = await seed();
		api.fail("time.start", 50);
		renderWithQuery(<TimerBar projects={projects} />);

		await userEvent.type(
			await screen.findByLabelText("何をしていますか"),
			"資料作り #仕事"
		);
		await userEvent.click(screen.getByRole("button", { name: "計測を始める" }));

		// The timer shows as running at once, in place of the box.
		expect(
			await screen.findByRole("button", { name: "計測を止める" })
		).toBeVisible();
		expect(await screen.findByLabelText("何をしていますか")).toHaveValue(
			"資料作り #仕事"
		);
	});

	it("offers the event happening now when the box is empty", async () => {
		const { projects } = await seed();
		stubEvent("ev", "研究室ミーティング", NOW - 30 * MINUTE);
		renderWithQuery(<TimerBar projects={projects} />);

		await userEvent.click(await screen.findByLabelText("何をしていますか"));

		expect(await screen.findByRole("option", { name: MEETING })).toBeVisible();
	});

	it("records the unrecorded event under way from its start", async () => {
		const { projects } = await seed();
		stubEvent("seminar", "ゼミ発表", NOW - 20 * MINUTE);
		renderWithQuery(<TimerBar projects={projects} />);

		// The clock stands at 14:20, so the event began at 14:00.
		await userEvent.click(
			await screen.findByRole("button", { name: "ゼミ発表を14:00から記録" })
		);

		await waitFor(async () =>
			expect(await api.caller.time.current()).toMatchObject({
				description: "ゼミ発表",
				projectId: null,
				startedAt: NOW - 20 * MINUTE,
			})
		);
	});

	it("puts the event aside with ×", async () => {
		const { projects } = await seed();
		stubEvent("seminar-2", "ゼミ発表", NOW - 20 * MINUTE);
		renderWithQuery(<TimerBar projects={projects} />);

		await userEvent.click(
			await screen.findByRole("button", { name: "今回は記録しない" })
		);

		expect(
			screen.queryByRole("button", { name: "ゼミ発表を14:00から記録" })
		).not.toBeInTheDocument();
	});

	it("shows the running entry and stops it", async () => {
		const { projects, work } = await seed();
		const entry = await api.caller.time.start({
			description: "会議",
			projectId: work.id,
			startedAt: NOW - 65_000,
		});
		const onEdit = vi.fn();
		renderWithQuery(<TimerBar onEdit={onEdit} projects={projects} />);

		expect(await screen.findByText("会議")).toBeInTheDocument();
		expect(screen.getByText("仕事")).toBeInTheDocument();
		expect(screen.getByText("0:01:05")).toBeInTheDocument();

		await userEvent.click(screen.getByText("会議"));
		expect(onEdit).toHaveBeenCalledWith(
			expect.objectContaining({ id: entry.id })
		);
		await userEvent.click(screen.getByRole("button", { name: "計測を止める" }));
		await waitFor(async () =>
			expect(await api.caller.time.current()).toBeNull()
		);
	});

	it("draws the orbit against the task's estimate", async () => {
		const { projects, work } = await seed();
		const task = await api.caller.task.create({
			estimateMinutes: 90,
			title: "スライド",
		});
		await api.caller.time.start({
			projectId: work.id,
			startedAt: NOW - 45 * MINUTE,
			taskId: task.id,
		});
		const { container } = renderWithQuery(
			<TimerBar
				estimateOf={(entry) => (entry.taskId === task.id ? 90 : null)}
				projects={projects}
			/>
		);

		expect(await screen.findByText("見積もり 90分")).toBeInTheDocument();
		expect(
			container.querySelector('[data-slot="timer-orbit"]')
		).toBeInTheDocument();
	});

	it("leaves the orbit out when the entry has no estimate", async () => {
		const { projects, work } = await seed();
		await api.caller.time.start({
			description: "会議",
			projectId: work.id,
			startedAt: NOW - 65_000,
		});
		const { container } = renderWithQuery(<TimerBar projects={projects} />);

		expect(await screen.findByText("会議")).toBeInTheDocument();
		expect(screen.queryByText(ESTIMATE)).not.toBeInTheDocument();
		expect(
			container.querySelector('[data-slot="timer-orbit"]')
		).not.toBeInTheDocument();
	});
});
