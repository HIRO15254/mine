import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/trpc", () => import("../../../__tests__/test-api"));

import { renderWithQuery } from "../../../__tests__/render";
import { api } from "../../../__tests__/test-api";
import { QuickAdd } from "../quick-add";

const TRAINING = /研修/;
const NEXT = /next/;

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

	it("completes #projects and @labels as they are typed", async () => {
		const { lab } = await seed();
		await api.caller.project.create({ name: "研修" });
		const next = await api.caller.label.create({ name: "next" });
		const projects = await api.client.project.list.query();
		const labels = await api.client.label.list.query();
		renderWithQuery(
			<QuickAdd labels={labels} onOpenEditor={vi.fn()} projects={projects} />
		);
		const input = screen.getByLabelText("タスクを追加");

		await userEvent.type(input, "論文を読む #研");
		expect(
			screen.getAllByRole("option").map((option) => option.textContent)
		).toEqual(["研究", "研修"]);
		await userEvent.keyboard("{Enter}");
		expect(input).toHaveValue("論文を読む #研究 ");
		expect(input).toHaveAttribute("aria-expanded", "false");

		await userEvent.type(input, "@n");
		expect(screen.getByRole("option", { name: NEXT })).toBeInTheDocument();
		await userEvent.keyboard("{Tab}");
		expect(input).toHaveValue("論文を読む #研究 @next ");
		expect(api.calls("task.create")).toEqual([]);

		await userEvent.keyboard("{Enter}");
		await waitFor(async () =>
			expect(
				await api.caller.task.list({ today: "2026-11-05", view: "open" })
			).toMatchObject([
				{
					labels: [{ id: next.id }],
					projectId: lab.id,
					title: "論文を読む",
				},
			])
		);
	});

	it("chooses with the arrow keys, by click, and closes with Escape", async () => {
		await seed();
		const training = await api.caller.project.create({ name: "研修" });
		const projects = await api.client.project.list.query();
		renderWithQuery(
			<QuickAdd labels={[]} onOpenEditor={vi.fn()} projects={projects} />
		);
		const input = screen.getByLabelText("タスクを追加");

		await userEvent.type(input, "#研{ArrowDown}");
		expect(screen.getByRole("option", { name: TRAINING })).toHaveAttribute(
			"aria-selected",
			"true"
		);
		await userEvent.keyboard("{Enter}");
		expect(input).toHaveValue("#研修 ");

		await userEvent.type(input, "#研{Escape}");
		expect(input).toHaveAttribute("aria-expanded", "false");
		await userEvent.keyboard("{Backspace}");
		await userEvent.click(screen.getByRole("option", { name: TRAINING }));
		expect(input).toHaveValue("#研修 #研修 ");

		await userEvent.type(input, "日報{Enter}");
		await waitFor(() =>
			expect(api.calls("task.create")).toMatchObject([
				{ projectId: training.id, title: "日報" },
			])
		);
	});
});
