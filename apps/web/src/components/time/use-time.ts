import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { findTask } from "@/components/tasks/optimistic";
import type { TimeEntry } from "@/lib/time";
import { trpc } from "@/utils/trpc";

export function useRunningEntry() {
	return useQuery({ ...trpc.time.current.queryOptions(), staleTime: 30_000 });
}

export function useInvalidateTime() {
	const queryClient = useQueryClient();
	return () => queryClient.invalidateQueries({ queryKey: trpc.time.pathKey() });
}

/** An entry the server has not answered for yet. */
export function isOptimisticEntry(entry: TimeEntry): boolean {
	return entry.id.startsWith("optimistic:");
}

/** Shows the timer running at once; the server's entry replaces it. */
export function useStartTimer() {
	const queryClient = useQueryClient();
	const invalidate = useInvalidateTime();
	const current = trpc.time.current.queryKey();
	return useMutation(
		trpc.time.start.mutationOptions({
			onMutate: async (input) => {
				await queryClient.cancelQueries({ queryKey: current });
				const previous = queryClient.getQueryData(current);
				const task = input.taskId ? findTask(queryClient, input.taskId) : null;
				const entry: TimeEntry = {
					billable: input.billable ?? true,
					description: input.description || task?.title || "",
					endedAt: null,
					id: `optimistic:${crypto.randomUUID()}`,
					projectId:
						input.projectId === undefined
							? (task?.projectId ?? null)
							: input.projectId,
					startedAt: input.startedAt ?? Date.now(),
					taskId: input.taskId ?? null,
				};
				queryClient.setQueryData(current, entry);
				return { previous };
			},
			onError: (_error, _input, context) => {
				queryClient.setQueryData(current, context?.previous ?? null);
				toast.error("計測を始められませんでした");
			},
			onSettled: invalidate,
		})
	);
}

/** Stops the timer on screen at once. */
export function useStopTimer() {
	const queryClient = useQueryClient();
	const invalidate = useInvalidateTime();
	const current = trpc.time.current.queryKey();
	return useMutation(
		trpc.time.stop.mutationOptions({
			onMutate: async () => {
				await queryClient.cancelQueries({ queryKey: current });
				const previous = queryClient.getQueryData(current);
				queryClient.setQueryData(current, null);
				return { previous };
			},
			onError: (_error, _input, context) => {
				queryClient.setQueryData(current, context?.previous ?? null);
				toast.error("計測を止められませんでした");
			},
			onSettled: invalidate,
		})
	);
}
