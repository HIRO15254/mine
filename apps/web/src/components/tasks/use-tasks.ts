import {
	useMutation,
	useMutationState,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";
import type { Task } from "@/lib/tasks";
import { todayKey } from "@/lib/tasks";
import { trpc } from "@/utils/trpc";

import {
	findTask,
	placeTask,
	removeTask,
	restoreTaskLists,
	snapshotTaskLists,
	taskFromInput,
} from "./optimistic";

/** How long a completed row stays to show its check before it leaves. */
const COMPLETE_POP_MS = 420;

const wait = (ms: number) =>
	new Promise<void>((resolve) => window.setTimeout(resolve, Math.max(ms, 0)));

/** Projects and labels, cached together because every task view needs both. */
export function useTaskContext() {
	const projects = useQuery({
		...trpc.project.list.queryOptions(),
		staleTime: 60_000,
	});
	const labels = useQuery({
		...trpc.label.list.queryOptions(),
		staleTime: 60_000,
	});
	return {
		isPending: projects.isPending || labels.isPending,
		labels: labels.data ?? [],
		projects: projects.data ?? [],
	};
}

export function useInvalidateTasks() {
	const queryClient = useQueryClient();
	return () =>
		Promise.all([
			queryClient.invalidateQueries({ queryKey: trpc.task.pathKey() }),
			queryClient.invalidateQueries({ queryKey: trpc.project.pathKey() }),
			queryClient.invalidateQueries({ queryKey: trpc.label.pathKey() }),
		]);
}

/*
 * Writes to tasks are optimistic and all work the same way: the cached lists
 * change at once, go back if the server refuses, and are refetched when it
 * has answered. `onRefused` runs after the lists are back; it is where the
 * caller says what went wrong.
 */

/** Adds a task; it is in the lists before the server has answered. */
export function useCreateTask(onRefused: () => void) {
	const queryClient = useQueryClient();
	const invalidate = useInvalidateTasks();
	return useMutation(
		trpc.task.create.mutationOptions({
			onMutate: async (input) => {
				const snapshot = await snapshotTaskLists(queryClient);
				placeTask(queryClient, taskFromInput(queryClient, input, null));
				return { snapshot };
			},
			onError: (_error, _input, context) => {
				restoreTaskLists(queryClient, context?.snapshot);
				onRefused();
			},
			onSettled: invalidate,
		})
	);
}

/**
 * Changes a task; it moves between the lists at once. `fallback` is the task
 * as the caller knows it, for when no cached list holds it.
 */
export function useUpdateTask(
	onRefused: () => void,
	fallback: Task | null = null
) {
	const queryClient = useQueryClient();
	const invalidate = useInvalidateTasks();
	return useMutation(
		trpc.task.update.mutationOptions({
			onMutate: async ({ id, ...input }) => {
				const snapshot = await snapshotTaskLists(queryClient);
				const base = findTask(queryClient, id) ?? fallback;
				if (base) {
					placeTask(queryClient, taskFromInput(queryClient, input, base));
				}
				return { snapshot };
			},
			onError: (_error, _input, context) => {
				restoreTaskLists(queryClient, context?.snapshot);
				onRefused();
			},
			onSettled: invalidate,
		})
	);
}

/** Deletes a task; it leaves the lists at once. */
export function useDeleteTask(onRefused: () => void, onDeleted: () => void) {
	const queryClient = useQueryClient();
	const invalidate = useInvalidateTasks();
	return useMutation(
		trpc.task.delete.mutationOptions({
			onMutate: async ({ id }) => {
				const snapshot = await snapshotTaskLists(queryClient);
				removeTask(queryClient, id);
				return { snapshot };
			},
			onError: (_error, _input, context) => {
				restoreTaskLists(queryClient, context?.snapshot);
				onRefused();
			},
			onSettled: invalidate,
			onSuccess: onDeleted,
		})
	);
}

/**
 * Completes a task and offers an undo toast. The row shows its check at once
 * and leaves the lists after a beat, without waiting for the server.
 */
export function useCompleteTask() {
	const queryClient = useQueryClient();
	const invalidate = useInvalidateTasks();
	const uncomplete = useMutation(
		trpc.task.uncomplete.mutationOptions({ onSettled: invalidate })
	);
	return useMutation(
		trpc.task.complete.mutationOptions({
			onMutate: async ({ id }) => {
				const snapshot = await snapshotTaskLists(queryClient);
				const timer = window.setTimeout(
					() => removeTask(queryClient, id),
					COMPLETE_POP_MS
				);
				return { snapshot, startedAt: Date.now(), timer };
			},
			onError: (_error, _input, context) => {
				if (context) {
					window.clearTimeout(context.timer);
					restoreTaskLists(queryClient, context.snapshot);
				}
				toast.error("完了にできませんでした");
			},
			// Refetch only after the row has left, so it does not come back.
			onSettled: async (_data, _error, _input, context) => {
				await wait(
					context ? COMPLETE_POP_MS - (Date.now() - context.startedAt) : 0
				);
				await invalidate();
			},
			onSuccess: (result) => {
				toast.success(
					result.recurring ? "次の予定に進めました" : "完了にしました",
					{
						description: result.task.title,
						action: {
							label: "元に戻す",
							onClick: () => uncomplete.mutate({ id: result.task.id }),
						},
					}
				);
			},
		})
	);
}

/** Ids of the tasks being completed right now, for their check animation. */
export function useCompletingIds(): Set<string> {
	const ids = useMutationState({
		filters: {
			mutationKey: trpc.task.complete.mutationKey(),
			status: "pending",
		},
		select: (mutation) =>
			(mutation.state.variables as { id?: string } | undefined)?.id ?? "",
	});
	return new Set(ids);
}

export function completeInput(id: string) {
	return { id, today: todayKey() };
}
