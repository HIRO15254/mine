import { IconCheck, IconExternalLink } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LoadingBlock } from "@/components/app-shell/loading-block";

import { useTaskContext } from "@/components/tasks/use-tasks";
import { Badge } from "@/components/ui/badge/badge";
import { IconButton } from "@/components/ui/icon-button/icon-button";
import { useIsDesk } from "@/hooks/use-media-query";
import { type Project, projectPath } from "@/lib/tasks";
import {
	type ClaudeThread,
	formatUpdated,
	sortThreads,
	THREAD_STATUS_LABEL,
} from "@/lib/threads";
import { trpc } from "@/lib/trpc";

/** Open Claude threads as they reported themselves over MCP. */
export function ThreadList() {
	const { projects } = useTaskContext();
	const threads = useQuery({
		...trpc.thread.list.queryOptions(),
		refetchInterval: 60_000,
	});

	if (threads.isPending) {
		return <LoadingBlock className="py-6" />;
	}
	if (threads.isError) {
		return (
			<p className="m-0 text-muted-foreground text-sm">
				スレッドを読み込めませんでした
			</p>
		);
	}
	if (threads.data.length === 0) {
		return (
			<p className="m-0 text-muted-foreground text-sm">
				動いているスレッドはありません。Claude に Mine
				をつなぐと、ここに状況が出ます。
			</p>
		);
	}
	return (
		<ul className="m-0 -mx-2 flex list-none flex-col divide-y divide-border p-0">
			{sortThreads(threads.data).map((thread) => (
				<ThreadRow key={thread.id} projects={projects} thread={thread} />
			))}
		</ul>
	);
}

function ThreadRow({
	projects,
	thread,
}: {
	projects: Project[];
	thread: ClaudeThread;
}) {
	const isDesk = useIsDesk();
	const queryClient = useQueryClient();
	const finish = useMutation(
		trpc.thread.setStatus.mutationOptions({
			onSettled: () =>
				queryClient.invalidateQueries({ queryKey: trpc.thread.pathKey() }),
		})
	);
	const detail =
		thread.status === "waiting" && thread.nextAction
			? thread.nextAction
			: thread.summary;
	const project = thread.projectId
		? projectPath(projects, thread.projectId)
		: null;

	return (
		<li className="flex items-start gap-2 px-2 py-2">
			<span className="flex min-w-0 flex-1 flex-col gap-1">
				<span className="flex min-w-0 items-center gap-2">
					<Badge
						className="shrink-0"
						variant={thread.status === "waiting" ? "default" : "secondary"}
					>
						{THREAD_STATUS_LABEL[thread.status]}
					</Badge>
					{thread.url ? (
						<a
							className="inline-flex min-w-0 items-center gap-1 text-foreground text-sm no-underline hover:underline"
							href={thread.url}
							rel="noopener noreferrer"
							target="_blank"
						>
							<span className="truncate">{thread.title}</span>
							<IconExternalLink
								aria-hidden
								className="size-3.5 shrink-0 text-muted-foreground"
							/>
						</a>
					) : (
						<span className="truncate text-sm">{thread.title}</span>
					)}
				</span>
				{detail && (
					<span className="line-clamp-2 text-muted-foreground text-xs">
						{detail}
					</span>
				)}
				<span className="text-muted-foreground text-xs">
					{project && `${project}・`}
					{formatUpdated(thread.updatedAt, Date.now())}
				</span>
			</span>
			<IconButton
				disabled={finish.isPending}
				label={`「${thread.title}」を完了にする`}
				onClick={() => finish.mutate({ id: thread.id, status: "done" })}
				size={isDesk ? "md" : "xl"}
			>
				<IconCheck aria-hidden />
			</IconButton>
		</li>
	);
}
