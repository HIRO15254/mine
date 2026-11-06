import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/utils/trpc", () => import("../../../__tests__/trpc-mock"));

import { renderWithQuery, useDesktopLayout } from "../../../__tests__/render";
import {
	makeLabel,
	makeProject,
	makeTask,
} from "../../../__tests__/task-fixtures";
import { trpcMock } from "../../../__tests__/trpc-mock";
import { TaskEditor } from "../task-editor";

const projects = [makeProject({ id: "lab", name: "研究" })];
const TITLE = /タイトル/;
const labels = [makeLabel({ id: "next", name: "next" })];

describe("TaskEditor", () => {
	beforeEach(() => {
		useDesktopLayout();
		for (const fn of Object.values(trpcMock.calls)) {
			fn.mockClear();
		}
	});

	it("adds a recurring task", async () => {
		const onOpenChange = vi.fn();
		renderWithQuery(
			<TaskEditor
				labels={labels}
				onOpenChange={onOpenChange}
				open
				projects={projects}
				task={null}
			/>
		);

		await userEvent.type(screen.getByLabelText(TITLE), "ゴミ出し");
		await userEvent.selectOptions(screen.getByLabelText("プロジェクト"), "lab");
		await userEvent.click(screen.getByRole("radio", { name: "P1" }));
		await userEvent.selectOptions(
			screen.getByLabelText("繰り返し"),
			"schedule"
		);
		await userEvent.click(screen.getByRole("button", { name: "月" }));
		await userEvent.click(screen.getByRole("button", { name: "木" }));
		await userEvent.click(screen.getByRole("button", { name: "next" }));
		await userEvent.click(screen.getByRole("button", { name: "保存" }));

		await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
		expect(trpcMock.calls.create).toHaveBeenCalledWith(
			expect.objectContaining({
				labelIds: ["next"],
				priority: 1,
				projectId: "lab",
				recurrence: {
					basis: "schedule",
					interval: 1,
					unit: "week",
					weekdays: [1, 4],
				},
				title: "ゴミ出し",
			}),
			expect.anything()
		);
	});

	it("blocks saving without a title", async () => {
		renderWithQuery(
			<TaskEditor
				labels={[]}
				onOpenChange={vi.fn()}
				open
				projects={[]}
				task={null}
			/>
		);

		await userEvent.click(screen.getByRole("button", { name: "保存" }));

		expect(screen.getByRole("alert")).toHaveTextContent(
			"タイトルを入力してください"
		);
		expect(trpcMock.calls.create).not.toHaveBeenCalled();
	});

	it("updates and deletes an existing task", async () => {
		const task = makeTask({ id: "t1", title: "古い" });
		renderWithQuery(
			<TaskEditor
				labels={[]}
				onOpenChange={vi.fn()}
				open
				projects={[]}
				task={task}
			/>
		);

		const title = screen.getByLabelText(TITLE);
		await userEvent.clear(title);
		await userEvent.type(title, "新しい");
		await userEvent.click(screen.getByRole("button", { name: "保存" }));
		await waitFor(() =>
			expect(trpcMock.calls.update).toHaveBeenCalledWith(
				expect.objectContaining({ id: "t1", title: "新しい" }),
				expect.anything()
			)
		);

		await userEvent.click(screen.getByRole("button", { name: "削除" }));
		expect(trpcMock.calls.remove).not.toHaveBeenCalled();
		await userEvent.click(
			screen.getByRole("button", { name: "もう一度押して削除" })
		);
		await waitFor(() =>
			expect(trpcMock.calls.remove).toHaveBeenCalledWith(
				{ id: "t1" },
				expect.anything()
			)
		);
	});
});
