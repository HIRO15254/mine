import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { todayKey } from "@/lib/tasks";
import { trpc } from "@/utils/trpc";

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

/** Completes a task and offers an undo toast. */
export function useCompleteTask() {
	const invalidate = useInvalidateTasks();
	const uncomplete = useMutation(
		trpc.task.uncomplete.mutationOptions({ onSettled: invalidate })
	);
	return useMutation(
		trpc.task.complete.mutationOptions({
			onSettled: invalidate,
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
			onError: () => toast.error("完了にできませんでした"),
		})
	);
}

export function completeInput(id: string) {
	return { id, today: todayKey() };
}
