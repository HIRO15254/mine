import { IconPlayerPlay } from "@tabler/icons-react";

import { IconButton } from "@/components/ui/icon-button/icon-button";
import { useIsDesk } from "@/hooks/use-media-query";
import { useNow } from "@/hooks/use-now";
import { formatClock } from "@/lib/calendar-time";
import { PROJECT_COLOR_CLASS, type Project, projectPath } from "@/lib/tasks";
import {
	entryDuration,
	formatDuration,
	groupEntriesByDay,
	type TimeEntry,
} from "@/lib/time";
import { cn } from "@/lib/utils";

import { useStartTimer } from "./use-time";

export function EntryList({
	entries,
	onOpen,
	projects,
}: {
	entries: TimeEntry[];
	onOpen: (entry: TimeEntry) => void;
	projects: Project[];
}) {
	const hasRunning = entries.some((entry) => entry.endedAt === null);
	const now = useNow(1000, hasRunning);
	const days = groupEntriesByDay(entries, now);

	return (
		<div className="flex flex-col gap-4">
			{days.map((day) => (
				<section aria-label={day.title} className="flex flex-col" key={day.day}>
					<h2 className="m-0 flex items-baseline justify-between gap-2 border-border border-b px-2 pb-1.5 font-semibold text-sm">
						{day.title}
						<span className="font-normal text-muted-foreground text-xs tabular-nums">
							{formatDuration(day.totalMs)}
						</span>
					</h2>
					<ul className="m-0 flex list-none flex-col divide-y divide-border p-0">
						{day.entries.map((entry) => (
							<EntryRow
								entry={entry}
								key={entry.id}
								now={now}
								onOpen={onOpen}
								projects={projects}
							/>
						))}
					</ul>
				</section>
			))}
		</div>
	);
}

function EntryRow({
	entry,
	now,
	onOpen,
	projects,
}: {
	entry: TimeEntry;
	now: number;
	onOpen: (entry: TimeEntry) => void;
	projects: Project[];
}) {
	const isDesk = useIsDesk();
	const start = useStartTimer();
	const project = projects.find((p) => p.id === entry.projectId);
	const running = entry.endedAt === null;
	const description = entry.description || "説明なし";

	return (
		<li className="flex items-center gap-1">
			<button
				className="flex min-h-[var(--m-list-row)] min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-md border-0 bg-transparent px-2 desk:py-1.5 py-2 text-left text-foreground outline-none hover:bg-accent focus-visible:shadow-[inset_0_0_0_2px_var(--ring)]"
				onClick={() => onOpen(entry)}
				type="button"
			>
				<span
					aria-hidden
					className={cn(
						"size-2.5 shrink-0 rounded-full",
						project
							? PROJECT_COLOR_CLASS[project.color]
							: "bg-muted-foreground/40"
					)}
				/>
				<span className="flex min-w-0 flex-1 flex-col gap-0.5">
					<span
						className={cn(
							"truncate desk:text-sm text-[length:var(--m-text-body)] leading-5",
							!entry.description && "text-muted-foreground"
						)}
					>
						{description}
					</span>
					<span className="truncate text-muted-foreground text-xs">
						{project ? projectPath(projects, project.id) : "プロジェクトなし"}
						{!entry.billable && "・請求なし"}
					</span>
				</span>
				<span className="flex shrink-0 flex-col items-end gap-0.5">
					<span
						className={cn(
							"text-sm tabular-nums",
							running && "text-success-text"
						)}
					>
						{formatDuration(entryDuration(entry, now))}
					</span>
					<span className="text-muted-foreground text-xs tabular-nums">
						{formatClock(entry.startedAt)}–
						{entry.endedAt === null ? "計測中" : formatClock(entry.endedAt)}
					</span>
				</span>
			</button>
			{running ? (
				<span
					aria-hidden
					className={cn(
						"shrink-0",
						isDesk ? "size-[var(--control-md)]" : "size-[var(--m-control)]"
					)}
				/>
			) : (
				<IconButton
					disabled={start.isPending}
					label={`「${description}」をもう一度計測`}
					onClick={() =>
						start.mutate({
							billable: entry.billable,
							description: entry.description,
							projectId: entry.projectId,
							taskId: entry.taskId,
						})
					}
					size={isDesk ? "md" : "xl"}
				>
					<IconPlayerPlay aria-hidden />
				</IconButton>
			)}
		</li>
	);
}
