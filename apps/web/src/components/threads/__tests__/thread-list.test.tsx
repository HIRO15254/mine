import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/utils/trpc", () => import("../../../__tests__/trpc-mock"));

import { renderWithQuery, useDesktopLayout } from "../../../__tests__/render";
import { trpcMock } from "../../../__tests__/trpc-mock";
import { ThreadList } from "../thread-list";

const NOW = Date.now();
const PROJECT_META = /^研究・/;
const EMPTY = /動いているスレッドはありません/;

afterEach(() => {
	trpcMock.state.threads = [];
	trpcMock.state.projects = [];
	trpcMock.calls.update.mockClear();
});

describe("ThreadList", () => {
	it("shows waiting threads first with what to do", async () => {
		useDesktopLayout();
		trpcMock.state.projects = [
			{
				archived: false,
				color: "chart-1",
				id: "p1",
				name: "研究",
				parentId: null,
				sortOrder: 0,
			},
		];
		trpcMock.state.threads = [
			{
				id: "a",
				nextAction: "",
				projectId: null,
				status: "working",
				summary: "テストを書いています",
				title: "API の修正",
				updatedAt: NOW,
				url: null,
			},
			{
				id: "b",
				nextAction: "要約の長さを決めてください",
				projectId: "p1",
				status: "waiting",
				summary: "下書きができました",
				title: "論文の要約",
				updatedAt: NOW - 60_000,
				url: "https://claude.ai/chat/abc",
			},
		];
		renderWithQuery(<ThreadList />);

		const items = await screen.findAllByRole("listitem");
		expect(
			within(items[0] as HTMLElement).getByText("あなた待ち")
		).toBeInTheDocument();
		expect(
			within(items[0] as HTMLElement).getByText("要約の長さを決めてください")
		).toBeInTheDocument();
		expect(screen.getByRole("link", { name: "論文の要約" })).toHaveAttribute(
			"href",
			"https://claude.ai/chat/abc"
		);
		expect(await screen.findByText(PROJECT_META)).toBeInTheDocument();
		expect(screen.getByText("テストを書いています")).toBeInTheDocument();

		await userEvent.click(
			screen.getByRole("button", { name: "「API の修正」を完了にする" })
		);
		expect(trpcMock.calls.update).toHaveBeenCalledWith(
			{ id: "a", status: "done" },
			expect.anything()
		);
	});

	it("explains the empty state", async () => {
		renderWithQuery(<ThreadList />);
		expect(await screen.findByText(EMPTY)).toBeInTheDocument();
	});
});
