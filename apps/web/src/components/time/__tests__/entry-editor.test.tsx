import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/utils/trpc", () => import("../../../__tests__/test-api"));

import { freezeNow, NOW } from "../../../__tests__/clock";
import { renderWithQuery, useDesktopLayout } from "../../../__tests__/render";
import { api } from "../../../__tests__/test-api";
import { EntryEditor } from "../entry-editor";

async function seed() {
	const work = await api.caller.project.create({ name: "仕事" });
	return { projects: await api.client.project.list.query(), work };
}

describe("EntryEditor", () => {
	beforeEach(async () => {
		useDesktopLayout();
		await api.reset();
		freezeNow();
	});

	it("adds a manual entry", async () => {
		const { projects, work } = await seed();
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
			work.id
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
		// An end before the start means the entry runs past midnight.
		const from = Date.parse("2026-11-05T22:30:00+09:00");
		const to = Date.parse("2026-11-06T00:15:00+09:00");
		expect(await api.caller.time.list({ from, to })).toMatchObject([
			{
				billable: false,
				description: "読書",
				endedAt: to,
				projectId: work.id,
				startedAt: from,
			},
		]);
	});

	it("edits a running entry without an end time", async () => {
		const { projects } = await seed();
		await api.caller.time.start({
			description: "作業",
			startedAt: NOW - 600_000,
		});
		const entry = await api.client.time.current.query();
		renderWithQuery(
			<EntryEditor
				entry={entry}
				onOpenChange={vi.fn()}
				open
				projects={projects}
			/>
		);

		expect(screen.getByText("計測中")).toBeInTheDocument();
		await userEvent.click(screen.getByRole("button", { name: "保存" }));

		await waitFor(() => expect(api.calls("time.update")).toHaveLength(1));
		expect(api.calls("time.update")[0]).toMatchObject({
			description: "作業",
			id: entry?.id,
		});
		expect(api.calls("time.update")[0]?.endedAt).toBeUndefined();
		expect(await api.caller.time.current()).toMatchObject({
			description: "作業",
			endedAt: null,
		});
	});
});
