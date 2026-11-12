/**
 * Optimistic edits of the cached task lists: a change shows at once and the
 * server's answer replaces it when the lists refetch. Each list is a
 * `task.list` query for one view; a task goes in or out of it by the same
 * rule the server uses (`inView`).
 */
import { compareTasks, inView } from "@mine/api/tasks/views";
import type { QueryClient, QueryKey } from "@tanstack/react-query";

import type { Label, Task, TaskInput, TaskView } from "@/lib/tasks";
import { trpc } from "@/lib/trpc";

type Snapshot = [QueryKey, Task[] | undefined][];

interface ListInput {
	today: string;
	view: TaskView;
}

const listKey = () => trpc.task.list.pathKey();

function inputOf(key: QueryKey): ListInput | null {
	const meta = key[1] as { input?: ListInput } | undefined;
	return meta?.input ?? null;
}

/** The task as the server's view rules take it: dates are not strings there. */
const asViewTask = (task: Task) => ({
	...task,
	createdAt: new Date(task.createdAt),
});

/** The server's own order (`compareTasks`), so a list does not jump on refetch. */
function sortTasks(tasks: Task[]): Task[] {
	return [...tasks].sort((a, b) => compareTasks(asViewTask(a), asViewTask(b)));
}

/** Stops refetches in flight and keeps the lists as they are now. */
export async function snapshotTaskLists(
	queryClient: QueryClient
): Promise<Snapshot> {
	await queryClient.cancelQueries({ queryKey: listKey() });
	return queryClient.getQueriesData<Task[]>({ queryKey: listKey() });
}

export function restoreTaskLists(
	queryClient: QueryClient,
	snapshot: Snapshot | undefined
): void {
	for (const [key, data] of snapshot ?? []) {
		queryClient.setQueryData(key, data);
	}
}

export function removeTask(queryClient: QueryClient, id: string): void {
	queryClient.setQueriesData<Task[]>({ queryKey: listKey() }, (tasks) =>
		tasks?.filter((task) => task.id !== id)
	);
}

/** Puts the task in every list that should show it, and takes it out of the rest. */
export function placeTask(queryClient: QueryClient, task: Task): void {
	for (const [key, tasks] of queryClient.getQueriesData<Task[]>({
		queryKey: listKey(),
	})) {
		const input = inputOf(key);
		if (!(tasks && input)) {
			continue;
		}
		const others = tasks.filter((item) => item.id !== task.id);
		const belongs = inView(asViewTask(task), input.view, input.today);
		if (!belongs && others.length === tasks.length) {
			continue;
		}
		const index = tasks.findIndex((item) => item.id === task.id);
		let next = others;
		if (belongs) {
			next = [...others];
			next.splice(index < 0 ? next.length : index, 0, task);
		}
		queryClient.setQueryData(key, sortTasks(next));
	}
}

export function findTask(queryClient: QueryClient, id: string): Task | null {
	for (const [, tasks] of queryClient.getQueriesData<Task[]>({
		queryKey: listKey(),
	})) {
		const task = tasks?.find((item) => item.id === id);
		if (task) {
			return task;
		}
	}
	return null;
}

/** The task as it will look once the server has saved `input`. */
export function taskFromInput(
	queryClient: QueryClient,
	input: Partial<TaskInput>,
	base: Task | null
): Task {
	const labels =
		queryClient.getQueryData<Label[]>(trpc.label.list.queryKey()) ?? [];
	const pick = <K extends keyof TaskInput>(
		key: K,
		fallback: Task[K & keyof Task]
	) =>
		(input[key] === undefined ? fallback : input[key]) as Task[K & keyof Task];
	return {
		completedAt: base?.completedAt ?? null,
		createdAt: base?.createdAt ?? new Date().toISOString(),
		deadline: pick("deadline", base?.deadline ?? null),
		estimateMinutes: pick("estimateMinutes", base?.estimateMinutes ?? null),
		id: base?.id ?? `optimistic:${crypto.randomUUID()}`,
		labels: input.labelIds
			? labels
					.filter((label) => input.labelIds?.includes(label.id))
					.map(({ id, name }) => ({ id, name }))
			: (base?.labels ?? []),
		note: pick("note", base?.note ?? ""),
		priority: pick("priority", base?.priority ?? 4),
		projectId: pick("projectId", base?.projectId ?? null),
		recurrence: pick("recurrence", base?.recurrence ?? null),
		scheduledDate: pick("scheduledDate", base?.scheduledDate ?? null),
		scheduledTime: pick("scheduledTime", base?.scheduledTime ?? null),
		sortOrder: base?.sortOrder ?? Number.MAX_SAFE_INTEGER,
		startDate: pick("startDate", base?.startDate ?? null),
		title: pick("title", base?.title ?? ""),
	};
}

/** Tasks not saved yet carry this id; they cannot be opened or completed. */
export function isOptimistic(task: Task): boolean {
	return task.id.startsWith("optimistic:");
}
