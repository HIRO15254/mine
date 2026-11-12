import {
	QueryClient,
	QueryClientProvider,
	useQuery,
} from "@tanstack/react-query";
import { act, renderHook, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { Toaster } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/trpc", () => import("../../../__tests__/test-api"));

import { freezeNow, TODAY } from "../../../__tests__/clock";
import { api, trpc } from "../../../__tests__/test-api";
import type { Task, TaskView } from "../../../lib/tasks";
import {
	completeInput,
	useCompleteTask,
	useCompletingIds,
	useCreateTask,
	useDeleteTask,
	useUpdateTask,
} from "../use-tasks";

const TOMORROW = "2026-11-11";
/** Long enough to look at the lists before the server's refusal arrives. */
const SLOW = 80;

const titles = (tasks: Task[] | undefined) =>
	(tasks ?? []).map((task) => task.title);

/**
 * The hooks as a screen uses them, beside the lists a screen would have
 * loaded. `fallback` is the task an editor holds without a list behind it.
 */
function setup(views: TaskView[] = ["today", "open"], fallback?: Task) {
	const refused = vi.fn();
	const deleted = vi.fn();
	const client = new QueryClient({
		defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
	});
	const wrapper = ({ children }: { children: ReactNode }) => (
		<QueryClientProvider client={client}>
			{children}
			<Toaster />
		</QueryClientProvider>
	);
	const list = (view: TaskView) =>
		trpc.task.list.queryOptions({ today: TODAY, view });
	const hook = renderHook(
		() => {
			const today = useQuery({
				...list("today"),
				enabled: views.includes("today"),
			});
			const open = useQuery({
				...list("open"),
				enabled: views.includes("open"),
			});
			return {
				complete: useCompleteTask(),
				completing: useCompletingIds(),
				create: useCreateTask(refused),
				loaded:
					(today.isSuccess || !views.includes("today")) &&
					(open.isSuccess || !views.includes("open")),
				open: titles(open.data),
				remove: useDeleteTask(refused, deleted),
				today: titles(today.data),
				update: useUpdateTask(refused, fallback),
			};
		},
		{ wrapper }
	);
	return { ...hook, deleted, refused };
}

async function loaded(hook: ReturnType<typeof setup>) {
	await waitFor(() => expect(hook.result.current.loaded).toBe(true));
	return hook.result;
}

const serverTitles = async (view: TaskView = "open") =>
	titles(await api.client.task.list.query({ today: TODAY, view }));

describe("task hooks", () => {
	beforeEach(async () => {
		await api.reset();
		freezeNow();
	});

	it("shows a new task at once and keeps the saved one", async () => {
		const hook = setup();
		const result = await loaded(hook);

		act(() =>
			result.current.create.mutate({ scheduledDate: TODAY, title: "電話する" })
		);

		await waitFor(() => expect(result.current.today).toEqual(["電話する"]));
		await waitFor(async () =>
			expect(await serverTitles("today")).toEqual(["電話する"])
		);
		await waitFor(() => expect(result.current.create.isSuccess).toBe(true));
		expect(result.current.today).toEqual(["電話する"]);
		expect(hook.refused).not.toHaveBeenCalled();
	});

	it("takes a new task back out when the server refuses it", async () => {
		const hook = setup();
		const result = await loaded(hook);
		api.fail("task.create", SLOW);

		act(() => result.current.create.mutate({ title: "電話する" }));

		await waitFor(() => expect(result.current.open).toEqual(["電話する"]));
		await waitFor(() => expect(hook.refused).toHaveBeenCalledTimes(1));
		expect(result.current.open).toEqual([]);
		expect(await serverTitles()).toEqual([]);
	});

	it("moves an edited task between lists and back when refused", async () => {
		const task = await api.caller.task.create({
			scheduledDate: TOMORROW,
			title: "レポート",
		});
		const hook = setup();
		const result = await loaded(hook);
		expect(result.current.today).toEqual([]);
		api.fail("task.update", SLOW);

		act(() =>
			result.current.update.mutate({ id: task.id, scheduledDate: TODAY })
		);

		await waitFor(() => expect(result.current.today).toEqual(["レポート"]));
		await waitFor(() => expect(hook.refused).toHaveBeenCalledTimes(1));
		expect(result.current.today).toEqual([]);
		expect(result.current.open).toEqual(["レポート"]);
	});

	it("places a task no loaded list holds from what the caller knows", async () => {
		await api.caller.task.create({ title: "レポート" });
		const [task] = await api.client.task.list.query({
			today: TODAY,
			view: "open",
		});
		// Only Today is loaded, and the task is not on it yet.
		const hook = setup(["today"], task);
		const result = await loaded(hook);
		api.fail("task.update", SLOW);

		act(() =>
			result.current.update.mutate({
				id: task?.id ?? "",
				scheduledDate: TODAY,
			})
		);

		await waitFor(() => expect(result.current.today).toEqual(["レポート"]));
		await waitFor(() => expect(hook.refused).toHaveBeenCalledTimes(1));
		expect(result.current.today).toEqual([]);
	});

	it("removes a deleted task at once and puts it back when refused", async () => {
		const task = await api.caller.task.create({ title: "牛乳を買う" });
		const hook = setup();
		const result = await loaded(hook);
		api.fail("task.delete", SLOW);

		act(() => result.current.remove.mutate({ id: task.id }));

		await waitFor(() => expect(result.current.open).toEqual([]));
		await waitFor(() => expect(hook.refused).toHaveBeenCalledTimes(1));
		expect(result.current.open).toEqual(["牛乳を買う"]);
		expect(hook.deleted).not.toHaveBeenCalled();
	});

	it("deletes a task and says so", async () => {
		const task = await api.caller.task.create({ title: "牛乳を買う" });
		const hook = setup();
		const result = await loaded(hook);

		act(() => result.current.remove.mutate({ id: task.id }));

		await waitFor(() => expect(hook.deleted).toHaveBeenCalledTimes(1));
		expect(await serverTitles()).toEqual([]);
		expect(result.current.open).toEqual([]);
	});

	it("completes a task and brings it back with the undo", async () => {
		const task = await api.caller.task.create({ title: "牛乳を買う" });
		const hook = setup();
		const result = await loaded(hook);

		act(() => result.current.complete.mutate(completeInput(task.id)));

		expect(await screen.findByText("完了にしました")).toBeInTheDocument();
		expect(screen.getByText("牛乳を買う")).toBeInTheDocument();
		await waitFor(() => expect(result.current.open).toEqual([]));
		expect(await serverTitles()).toEqual([]);

		await userEvent.click(screen.getByRole("button", { name: "元に戻す" }));

		await waitFor(() => expect(result.current.open).toEqual(["牛乳を買う"]));
		expect(await serverTitles()).toEqual(["牛乳を買う"]);
	});

	it("moves a recurring task to its next day", async () => {
		const task = await api.caller.task.create({
			recurrence: { basis: "schedule", interval: 1, unit: "day" },
			scheduledDate: TODAY,
			title: "日報",
		});
		const hook = setup();
		const result = await loaded(hook);

		act(() => result.current.complete.mutate(completeInput(task.id)));

		expect(await screen.findByText("次の予定に進めました")).toBeInTheDocument();
		await waitFor(async () =>
			expect(
				await api.client.task.list.query({ today: TODAY, view: "open" })
			).toMatchObject([{ scheduledDate: TOMORROW, title: "日報" }])
		);
		// It is off Today and still open.
		await waitFor(() => expect(result.current.today).toEqual([]));
		await waitFor(() => expect(result.current.open).toEqual(["日報"]));
	});

	it("keeps the task when completing is refused", async () => {
		const task = await api.caller.task.create({ title: "牛乳を買う" });
		const hook = setup();
		const result = await loaded(hook);
		api.fail("task.complete", SLOW);

		act(() => result.current.complete.mutate(completeInput(task.id)));

		// The row shows its check while the answer is on its way.
		await waitFor(() =>
			expect([...result.current.completing]).toEqual([task.id])
		);
		expect(
			await screen.findByText("完了にできませんでした")
		).toBeInTheDocument();
		expect(result.current.open).toEqual(["牛乳を買う"]);
		// The check goes away with the refusal, not after the row's exit time.
		await waitFor(() => expect(result.current.completing.size).toBe(0), {
			timeout: 200,
		});
	});
});
