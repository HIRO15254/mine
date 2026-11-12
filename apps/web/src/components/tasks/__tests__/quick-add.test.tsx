import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/trpc", () => import("../../../__tests__/test-api"));

import { renderWithQuery } from "../../../__tests__/render";
import { api } from "../../../__tests__/test-api";
import { QuickAdd } from "../quick-add";

async function seed() {
	const lab = await api.caller.project.create({ name: "研究" });
	return { lab, projects: await api.client.project.list.query() };
}

describe("QuickAdd", () => {
	beforeEach(() => api.reset());

	it("creates a task from the parsed entry", async () => {
		const { lab, projects } = await seed();
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
		await waitFor(async () =>
			expect(
				await api.caller.task.list({ today: "2026-11-05", view: "open" })
			).toMatchObject([
				{
					labels: [],
					priority: 2,
					projectId: lab.id,
					scheduledDate: "2026-11-05",
					title: "論文を読む",
				},
			])
		);
	});

	it("ignores entries with no title and opens the full editor", async () => {
		const { projects } = await seed();
		const onOpenEditor = vi.fn();
		renderWithQuery(
			<QuickAdd labels={[]} onOpenEditor={onOpenEditor} projects={projects} />
		);

		await userEvent.type(screen.getByLabelText("タスクを追加"), "p1{Enter}");
		await userEvent.click(screen.getByRole("button", { name: "詳しく入力" }));

		expect(api.calls("task.create")).toEqual([]);
		expect(onOpenEditor).toHaveBeenCalledOnce();
	});

	it("starts with shared text, focused, and reports the add", async () => {
		const { projects } = await seed();
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
		expect(api.calls("task.create")).toMatchObject([
			{ title: "あとで読む https://example.com/a" },
		]);
	});
});
