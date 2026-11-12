import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/utils/trpc", () => import("../../../__tests__/test-api"));

import { renderWithQuery, useDesktopLayout } from "../../../__tests__/render";
import { api } from "../../../__tests__/test-api";
import { TaskEditor } from "../task-editor";

const TITLE = /タイトル/;
const TODAY = "2026-11-10";

const openTasks = () => api.caller.task.list({ today: TODAY, view: "open" });

describe("TaskEditor", () => {
	beforeEach(async () => {
		useDesktopLayout();
		await api.reset();
	});

	it("adds a recurring task", async () => {
		const lab = await api.caller.project.create({ name: "研究" });
		const next = await api.caller.label.create({ name: "next" });
		const onOpenChange = vi.fn();
		renderWithQuery(
			<TaskEditor
				labels={await api.client.label.list.query()}
				onOpenChange={onOpenChange}
				open
				projects={await api.client.project.list.query()}
				task={null}
			/>
		);

		await userEvent.type(screen.getByLabelText(TITLE), "ゴミ出し");
		await userEvent.selectOptions(
			screen.getByLabelText("プロジェクト"),
			lab.id
		);
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
		await waitFor(async () =>
			expect(await openTasks()).toMatchObject([
				{
					labels: [{ id: next.id, name: "next" }],
					priority: 1,
					projectId: lab.id,
					recurrence: {
						basis: "schedule",
						interval: 1,
						unit: "week",
						weekdays: [1, 4],
					},
					title: "ゴミ出し",
				},
			])
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
		expect(api.calls("task.create")).toEqual([]);
	});

	it("updates and deletes an existing task", async () => {
		const created = await api.caller.task.create({ title: "古い" });
		const [task] = await api.client.task.list.query({
			today: TODAY,
			view: "open",
		});
		renderWithQuery(
			<TaskEditor
				labels={[]}
				onOpenChange={vi.fn()}
				open
				projects={[]}
				task={task ?? null}
			/>
		);

		const title = screen.getByLabelText(TITLE);
		await userEvent.clear(title);
		await userEvent.type(title, "新しい");
		await userEvent.click(screen.getByRole("button", { name: "保存" }));
		await waitFor(async () =>
			expect(await openTasks()).toMatchObject([
				{ id: created.id, title: "新しい" },
			])
		);

		await userEvent.click(screen.getByRole("button", { name: "削除" }));
		expect(api.calls("task.delete")).toEqual([]);
		await userEvent.click(
			screen.getByRole("button", { name: "もう一度押して削除" })
		);
		await waitFor(async () => expect(await openTasks()).toEqual([]));
	});
});
