import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/utils/trpc", () => import("../../../__tests__/trpc-mock"));

import { makeTask } from "../../../__tests__/task-fixtures";
import {
	findTask,
	placeTask,
	removeTask,
	restoreTaskLists,
	snapshotTaskLists,
	taskFromInput,
} from "../optimistic";

const TODAY = "2026-11-10";
const key = (view: string) => [
	["task", "list"],
	{ input: { today: TODAY, view } },
];

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
	queryClient.setQueryData(
		[["label", "list"]],
		[{ id: "l-next", name: "next" }]
	);
	const list = (view: string) =>
		(queryClient.getQueryData(key(view)) as Array<{ id: string }>).map(
			(task) => task.id
		);
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
