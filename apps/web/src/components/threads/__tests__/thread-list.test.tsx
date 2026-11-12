import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/utils/trpc", () => import("../../../__tests__/test-api"));

import { freezeNow, NOW } from "../../../__tests__/clock";
import { renderWithQuery, useDesktopLayout } from "../../../__tests__/render";
import { api } from "../../../__tests__/test-api";
import { ThreadList } from "../thread-list";

const PROJECT_META = /^研究・/;
const EMPTY = /動いているスレッドはありません/;

describe("ThreadList", () => {
	beforeEach(async () => {
		await api.reset();
		freezeNow();
	});

	it("shows waiting threads first with what to do", async () => {
		useDesktopLayout();
		const lab = await api.caller.project.create({ name: "研究" });
		// The waiting thread reported first: it leads for its status, not its age.
		api.clock.now = NOW - 60_000;
		await api.caller.thread.report({
			nextAction: "要約の長さを決めてください",
			projectId: lab.id,
			status: "waiting",
			summary: "下書きができました",
			title: "論文の要約",
			url: "https://claude.ai/chat/abc",
		});
		api.clock.now = NOW;
		const working = await api.caller.thread.report({
			status: "working",
			summary: "テストを書いています",
			title: "API の修正",
		});
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

		expect(api.calls("thread.setStatus")).toEqual([
			{ id: working.id, status: "done" },
		]);
		await waitFor(() =>
			expect(screen.queryByText("API の修正")).not.toBeInTheDocument()
		);
	});

	it("explains the empty state", async () => {
		renderWithQuery(<ThreadList />);
		expect(await screen.findByText(EMPTY)).toBeInTheDocument();
	});
});
