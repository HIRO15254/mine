import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/utils/trpc", () => import("../../../__tests__/trpc-mock"));

import { renderWithQuery } from "../../../__tests__/render";
import { makeProject } from "../../../__tests__/task-fixtures";
import { trpcMock } from "../../../__tests__/trpc-mock";
import { QuickAdd } from "../quick-add";

const projects = [makeProject({ id: "lab", name: "研究" })];

describe("QuickAdd", () => {
	beforeEach(() => {
		trpcMock.calls.create.mockClear();
	});

	it("creates a task from the parsed entry", async () => {
		renderWithQuery(
			<QuickAdd
				defaults={{ scheduledDate: "2026-11-05" }}
				labels={[]}
				onOpenEditor={vi.fn()}
				projects={projects}
			/>
		);
		const input = screen.getByLabelText("タスクを追加");

		await userEvent.type(input, "論文を読む p2 #研究{Enter}");

		await waitFor(() => expect(input).toHaveValue(""));
		expect(trpcMock.calls.create).toHaveBeenCalledWith(
			{
				labelIds: [],
				priority: 2,
				projectId: "lab",
				scheduledDate: "2026-11-05",
				title: "論文を読む",
			},
			expect.anything()
		);
	});

	it("ignores entries with no title and opens the full editor", async () => {
		const onOpenEditor = vi.fn();
		renderWithQuery(
			<QuickAdd labels={[]} onOpenEditor={onOpenEditor} projects={projects} />
		);

		await userEvent.type(screen.getByLabelText("タスクを追加"), "p1{Enter}");
		await userEvent.click(screen.getByRole("button", { name: "詳しく入力" }));

		expect(trpcMock.calls.create).not.toHaveBeenCalled();
		expect(onOpenEditor).toHaveBeenCalledOnce();
	});

	it("starts with shared text, focused, and reports the add", async () => {
		const onAdded = vi.fn();
		renderWithQuery(
			<QuickAdd
				autoFocus
				initialText="あとで読む https://example.com/a"
				labels={[]}
				onAdded={onAdded}
				onOpenEditor={vi.fn()}
				projects={projects}
			/>
		);
		const input = screen.getByLabelText("タスクを追加");
		expect(input).toHaveFocus();
		expect(input).toHaveValue("あとで読む https://example.com/a");

		await userEvent.type(input, "{Enter}");

		await waitFor(() => expect(onAdded).toHaveBeenCalledOnce());
		expect(trpcMock.calls.create).toHaveBeenCalledWith(
			expect.objectContaining({ title: "あとで読む https://example.com/a" }),
			expect.anything()
		);
	});
});
