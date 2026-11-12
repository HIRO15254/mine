import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/utils/trpc", () => import("../../../__tests__/test-api"));

import { TODAY } from "../../../__tests__/clock";
import { makeTask } from "../../../__tests__/task-fixtures";
import { trpc } from "../../../__tests__/test-api";
import {
	findTask,
	placeTask,
	removeTask,
	restoreTaskLists,
	snapshotTaskLists,
	taskFromInput,
} from "../optimistic";

type View = "inbox" | "open" | "today";
/** The keys the screens use, so a change in their shape fails here. */
const key = (view: View) => trpc.task.list.queryKey({ today: TODAY, view });

function setup() {
	const queryClient = new QueryClient();
	const milk = makeTask({ id: "milk", priority: 4, scheduledDate: TODAY });
	const report = makeTask({
		id: "report",
		priority: 2,
		projectId: "work",
		title: "レポート",
	});
	queryClient.setQueryData(key("today"), [milk]);
	queryClient.setQueryData(key("open"), [report, milk]);
	queryClient.setQueryData(key("inbox"), [milk]);
	queryClient.setQueryData(trpc.label.list.queryKey(), [
		{ id: "l-next", name: "next", sortOrder: 0 },
	]);
	const list = (view: View) =>
		(queryClient.getQueryData(key(view)) ?? []).map((task) => task.id);
	return { list, milk, queryClient, report };
}

describe("optimistic task lists", () => {
	it("adds a new task to the views it belongs to, in priority order", () => {
		const { list, queryClient } = setup();
		const task = taskFromInput(
			queryClient,
			{ labelIds: ["l-next"], priority: 1, title: "電話する" },
			null
		);

		placeTask(queryClient, task);

		expect(task.labels).toEqual([{ id: "l-next", name: "next" }]);
		expect(list("today")).toEqual([task.id, "milk"]);
		expect(list("open")).toEqual([task.id, "report", "milk"]);
		expect(list("inbox")).toEqual([task.id, "milk"]);
	});

	it("keeps what an edit leaves out, even when the key is there", () => {
		const { queryClient, report } = setup();

		// The editor sends every field; the ones it did not touch are undefined.
		const edited = taskFromInput(
			queryClient,
			{ priority: undefined, projectId: null, title: "報告書" },
			report
		);

		expect(edited).toMatchObject({
			priority: 2,
			projectId: null,
			title: "報告書",
		});
	});

	it("moves an edited task between views and removes a deleted one", () => {
		const { list, queryClient } = setup();
		const base = findTask(queryClient, "milk");
		placeTask(
			queryClient,
			taskFromInput(
				queryClient,
				{ projectId: "work", scheduledDate: null },
				base
			)
		);
		expect(list("today")).toEqual([]);
		expect(list("inbox")).toEqual([]);
		expect(list("open")).toEqual(["report", "milk"]);

		removeTask(queryClient, "report");
		expect(list("open")).toEqual(["milk"]);
	});

	it("puts the lists back from a snapshot", async () => {
		const { list, queryClient } = setup();
		const snapshot = await snapshotTaskLists(queryClient);
		removeTask(queryClient, "milk");

		restoreTaskLists(queryClient, snapshot);

		expect(list("today")).toEqual(["milk"]);
		expect(list("open")).toEqual(["report", "milk"]);
	});
});
