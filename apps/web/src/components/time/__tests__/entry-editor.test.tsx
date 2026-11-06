import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/utils/trpc", () => import("../../../__tests__/trpc-mock"));

import { renderWithQuery, useDesktopLayout } from "../../../__tests__/render";
import { makeProject } from "../../../__tests__/task-fixtures";
import { trpcMock } from "../../../__tests__/trpc-mock";
import { EntryEditor } from "../entry-editor";

const projects = [makeProject({ id: "work", name: "仕事" })];

describe("EntryEditor", () => {
	beforeEach(() => {
		useDesktopLayout();
		trpcMock.calls.timeCreate.mockClear();
		trpcMock.calls.update.mockClear();
	});

	it("adds a manual entry", async () => {
		const onOpenChange = vi.fn();
		renderWithQuery(
			<EntryEditor
				entry={null}
				onOpenChange={onOpenChange}
				open
				projects={projects}
			/>
		);

		await userEvent.type(screen.getByLabelText("説明"), "読書");
		await userEvent.selectOptions(
			screen.getByLabelText("プロジェクト"),
			"work"
		);
		fireEvent.change(screen.getByLabelText("日付"), {
			target: { value: "2026-11-05" },
		});
		fireEvent.change(screen.getByLabelText("開始"), {
			target: { value: "22:30" },
		});
		fireEvent.change(screen.getByLabelText("終了"), {
			target: { value: "00:15" },
		});
		await userEvent.click(screen.getByLabelText("請求の対象にする"));
		await userEvent.click(screen.getByRole("button", { name: "保存" }));

		await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
		expect(trpcMock.calls.timeCreate).toHaveBeenCalledWith(
			{
				billable: false,
				description: "読書",
				endedAt: new Date(2026, 10, 6, 0, 15).getTime(),
				projectId: "work",
				startedAt: new Date(2026, 10, 5, 22, 30).getTime(),
			},
			expect.anything()
		);
	});

	it("edits a running entry without an end time", async () => {
		const startedAt = Date.now() - 600_000;
		renderWithQuery(
			<EntryEditor
				entry={{
					billable: true,
					description: "作業",
					endedAt: null,
					id: "e",
					projectId: null,
					startedAt,
					taskId: null,
				}}
				onOpenChange={vi.fn()}
				open
				projects={projects}
			/>
		);

		expect(screen.getByText("計測中")).toBeInTheDocument();
		await userEvent.click(screen.getByRole("button", { name: "保存" }));

		await waitFor(() =>
			expect(trpcMock.calls.update).toHaveBeenCalledWith(
				expect.not.objectContaining({ endedAt: expect.anything() }),
				expect.anything()
			)
		);
		expect(trpcMock.calls.update).toHaveBeenCalledWith(
			expect.objectContaining({ description: "作業", id: "e" }),
			expect.anything()
		);
	});
});
