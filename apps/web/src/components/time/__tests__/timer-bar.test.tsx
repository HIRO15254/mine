import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/utils/trpc", () => import("../../../__tests__/trpc-mock"));

import { renderWithQuery } from "../../../__tests__/render";
import { makeProject } from "../../../__tests__/task-fixtures";
import { trpcMock } from "../../../__tests__/trpc-mock";
import { TimerBar } from "../timer-bar";

const ELAPSED = /^0:01:0\d$/;
const ESTIMATE = /見積もり/;
const projects = [makeProject({ id: "work", name: "仕事" })];

describe("TimerBar", () => {
	beforeEach(() => {
		trpcMock.calls.timeStart.mockClear();
		trpcMock.calls.timeStop.mockClear();
		trpcMock.state.current = null;
	});

	it("starts a timer with a description and project", async () => {
		renderWithQuery(<TimerBar projects={projects} />);

		await userEvent.type(
			await screen.findByLabelText("何をしていますか"),
			"資料作り"
		);
		await userEvent.selectOptions(
			screen.getByLabelText("プロジェクト"),
			"work"
		);
		await userEvent.click(screen.getByRole("button", { name: "計測を始める" }));

		await waitFor(() =>
			expect(trpcMock.calls.timeStart).toHaveBeenCalledWith(
				{ description: "資料作り", projectId: "work" },
				expect.anything()
			)
		);
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
