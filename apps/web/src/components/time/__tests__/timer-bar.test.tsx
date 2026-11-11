import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/utils/trpc", () => import("../../../__tests__/trpc-mock"));

import { renderWithQuery } from "../../../__tests__/render";
import { makeProject, makeTask } from "../../../__tests__/task-fixtures";
import { trpcMock } from "../../../__tests__/trpc-mock";
import { TimerBar } from "../timer-bar";

const ELAPSED = /^0:01:0\d$/;
const ESTIMATE = /見積もり/;
const WORK = /仕事/;
const REPORT = /週次レポートを送る/;
const MEETING = /研究室ミーティング/;
const DOCS = /資料/;
const CAMP = /合宿の準備/;
const RECORD_SEMINAR = /^ゼミ発表を\d\d:\d\dから記録$/;
const projects = [makeProject({ color: "chart-2", id: "work", name: "仕事" })];

describe("TimerBar", () => {
	beforeEach(() => {
		trpcMock.calls.timeStart.mockClear();
		trpcMock.calls.timeStop.mockClear();
		trpcMock.state.current = null;
		trpcMock.state.entries = [];
		trpcMock.state.events = [];
		trpcMock.state.tasks = [];
	});

	it("starts a timer with a description and a #project", async () => {
		const { container } = renderWithQuery(<TimerBar projects={projects} />);

		await userEvent.type(
			await screen.findByLabelText("何をしていますか"),
			"資料作り #仕事 "
		);
		expect(
			container.querySelector('mark[data-project="work"]')
		).toHaveTextContent("#仕事");
		await userEvent.click(screen.getByRole("button", { name: "計測を始める" }));

		await waitFor(() =>
			expect(trpcMock.calls.timeStart).toHaveBeenCalledWith(
				{ description: "資料作り", projectId: "work", taskId: undefined },
				expect.anything()
			)
		);
	});

	it("completes a #project from the suggestions", async () => {
		renderWithQuery(<TimerBar projects={projects} />);

		const input = await screen.findByLabelText("何をしていますか");
		await userEvent.type(input, "会議 #仕");
		expect(await screen.findByRole("option", { name: WORK })).toBeVisible();
		await userEvent.keyboard("{Enter}");

		expect(input).toHaveValue("会議 #仕事 ");
		expect(trpcMock.calls.timeStart).not.toHaveBeenCalled();
	});

	it("leaves keys to the IME while kana is being converted", async () => {
		renderWithQuery(<TimerBar projects={projects} />);

		const input = await screen.findByLabelText("何をしていますか");
		await userEvent.type(input, "会議 #仕");
		expect(await screen.findByRole("option", { name: WORK })).toBeVisible();
		// Enter that confirms the conversion must not pick the suggestion.
		fireEvent.keyDown(input, { isComposing: true, key: "Enter" });

		expect(input).toHaveValue("会議 #仕");
	});

	it("starts a suggested task with its project", async () => {
		trpcMock.state.tasks = [
			makeTask({ id: "t1", projectId: "work", title: "週次レポートを送る" }),
		];
		renderWithQuery(<TimerBar projects={projects} />);

		await userEvent.type(
			await screen.findByLabelText("何をしていますか"),
			"レポート"
		);
		await userEvent.click(await screen.findByRole("option", { name: REPORT }));
		await userEvent.click(screen.getByRole("button", { name: "計測を始める" }));

		await waitFor(() =>
			expect(trpcMock.calls.timeStart).toHaveBeenCalledWith(
				{ description: "週次レポートを送る", projectId: "work", taskId: "t1" },
				expect.anything()
			)
		);
	});

	it("links a picked task whose title has a full-width space", async () => {
		trpcMock.state.tasks = [
			makeTask({ id: "t2", projectId: null, title: "資料　確認" }),
		];
		renderWithQuery(<TimerBar projects={projects} />);

		await userEvent.type(
			await screen.findByLabelText("何をしていますか"),
			"資料"
		);
		await userEvent.click(await screen.findByRole("option", { name: DOCS }));
		await userEvent.click(screen.getByRole("button", { name: "計測を始める" }));

		await waitFor(() =>
			expect(trpcMock.calls.timeStart).toHaveBeenCalledWith(
				{ description: "資料 確認", projectId: null, taskId: "t2" },
				expect.anything()
			)
		);
	});

	it("starts on the picked project when another has the same name", async () => {
		const twins = [
			makeProject({ id: "uni-lab", name: "研究" }),
			makeProject({ id: "club-lab", name: "研究", parentId: "club" }),
			makeProject({ id: "club", name: "サークル" }),
		];
		trpcMock.state.tasks = [
			makeTask({ id: "t3", projectId: "club-lab", title: "合宿の準備" }),
		];
		renderWithQuery(<TimerBar projects={twins} />);

		await userEvent.type(
			await screen.findByLabelText("何をしていますか"),
			"合宿"
		);
		await userEvent.click(await screen.findByRole("option", { name: CAMP }));
		await userEvent.click(screen.getByRole("button", { name: "計測を始める" }));

		await waitFor(() =>
			expect(trpcMock.calls.timeStart).toHaveBeenCalledWith(
				{ description: "合宿の準備", projectId: "club-lab", taskId: "t3" },
				expect.anything()
			)
		);
	});

	it("gives the text back when the start fails", async () => {
		trpcMock.calls.timeStart.mockImplementationOnce(
			() =>
				new Promise((_resolve, reject) => {
					setTimeout(() => reject(new Error("offline")), 50);
				})
		);
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
		const now = Date.now();
		trpcMock.state.events = [
			{
				allDay: false,
				calendarId: "primary",
				color: "#4593f8",
				end: new Date(now + 30 * 60_000).toISOString(),
				htmlLink: null,
				id: "ev",
				location: null,
				start: new Date(now - 30 * 60_000).toISOString(),
				title: "研究室ミーティング",
			},
		];
		renderWithQuery(<TimerBar projects={projects} />);

		await userEvent.click(await screen.findByLabelText("何をしていますか"));

		expect(await screen.findByRole("option", { name: MEETING })).toBeVisible();
	});

	it("records the unrecorded event under way from its start", async () => {
		const now = Date.now();
		const start = now - 20 * 60_000;
		trpcMock.state.events = [
			{
				allDay: false,
				calendarId: "primary",
				color: "#e67c73",
				end: new Date(now + 40 * 60_000).toISOString(),
				htmlLink: null,
				id: "seminar",
				location: null,
				start: new Date(start).toISOString(),
				title: "ゼミ発表",
			},
		];
		renderWithQuery(<TimerBar projects={projects} />);

		await userEvent.click(
			await screen.findByRole("button", { name: RECORD_SEMINAR })
		);

		await waitFor(() =>
			expect(trpcMock.calls.timeStart).toHaveBeenCalledWith(
				{ description: "ゼミ発表", projectId: null, startedAt: start },
				expect.anything()
			)
		);
	});

	it("puts the event aside with ×", async () => {
		const now = Date.now();
		trpcMock.state.events = [
			{
				allDay: false,
				calendarId: "primary",
				color: "#e67c73",
				end: new Date(now + 40 * 60_000).toISOString(),
				htmlLink: null,
				id: "seminar-2",
				location: null,
				start: new Date(now - 20 * 60_000).toISOString(),
				title: "ゼミ発表",
			},
		];
		renderWithQuery(<TimerBar projects={projects} />);

		await userEvent.click(
			await screen.findByRole("button", { name: "今回は記録しない" })
		);

		expect(
			screen.queryByRole("button", { name: RECORD_SEMINAR })
		).not.toBeInTheDocument();
	});

	it("shows the running entry and stops it", async () => {
		trpcMock.state.current = {
			billable: true,
			description: "会議",
			endedAt: null,
			id: "e",
			projectId: "work",
			startedAt: Date.now() - 65_000,
			taskId: null,
		};
		const onEdit = vi.fn();
		renderWithQuery(<TimerBar onEdit={onEdit} projects={projects} />);

		expect(await screen.findByText("会議")).toBeInTheDocument();
		expect(screen.getByText("仕事")).toBeInTheDocument();
		expect(screen.getByText(ELAPSED)).toBeInTheDocument();

		await userEvent.click(screen.getByText("会議"));
		expect(onEdit).toHaveBeenCalledWith(expect.objectContaining({ id: "e" }));
		await userEvent.click(screen.getByRole("button", { name: "計測を止める" }));
		await waitFor(() => expect(trpcMock.calls.timeStop).toHaveBeenCalled());
	});

	it("draws the orbit against the task's estimate", async () => {
		trpcMock.state.current = {
			billable: true,
			description: "スライド",
			endedAt: null,
			id: "e",
			projectId: "work",
			startedAt: Date.now() - 45 * 60_000,
			taskId: "t",
		};
		const { container } = renderWithQuery(
			<TimerBar
				estimateOf={(entry) => (entry.taskId === "t" ? 90 : null)}
				projects={projects}
			/>
		);

		expect(await screen.findByText("見積もり 90分")).toBeInTheDocument();
		expect(
			container.querySelector('[data-slot="timer-orbit"]')
		).toBeInTheDocument();
	});

	it("leaves the orbit out when the entry has no estimate", async () => {
		trpcMock.state.current = {
			billable: true,
			description: "会議",
			endedAt: null,
			id: "e",
			projectId: "work",
			startedAt: Date.now() - 65_000,
			taskId: null,
		};
		const { container } = renderWithQuery(<TimerBar projects={projects} />);

		expect(await screen.findByText("会議")).toBeInTheDocument();
		expect(screen.queryByText(ESTIMATE)).not.toBeInTheDocument();
		expect(
			container.querySelector('[data-slot="timer-orbit"]')
		).not.toBeInTheDocument();
	});
});
