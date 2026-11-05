import {
	IconCalendarEvent,
	IconCheck,
	IconFlag,
	IconHourglass,
	IconRepeat,
} from "@tabler/icons-react";

import {
	dueTone,
	formatDay,
	formatRecurrence,
	PRIORITY_RING,
	PROJECT_COLOR_CLASS,
	type Project,
	projectPath,
	type Task,
} from "@/lib/tasks";
import { cn } from "@/lib/utils";

const TONE_CLASS = {
	overdue: "text-destructive-text",
	today: "text-success-text",
	soon: "text-warning-text",
	later: "text-muted-foreground",
} as const;

export function TaskRow({
	isCompleting = false,
	onComplete,
	onOpen,
	projects,
	showProject = true,
	task,
	today,
}: {
	isCompleting?: boolean;
	onComplete: (task: Task) => void;
	onOpen: (task: Task) => void;
	projects: Project[];
	showProject?: boolean;
	task: Task;
	today: string;
}) {
	const project = projects.find((p) => p.id === task.projectId);
	const hasMeta =
		task.scheduledDate ||
		task.deadline ||
		task.recurrence ||
		task.labels.length > 0 ||
		(showProject && project) ||
		task.estimateMinutes;
	return (
		<div className="group/task flex min-h-[var(--m-list-row)] items-start gap-2.5 rounded-md px-2 desk:py-1.5 py-2">
			<button
				aria-label={`「${task.title}」を完了にする`}
				className={cn(
					"mt-0.5 flex size-[18px] shrink-0 cursor-pointer items-center justify-center rounded-full border-[1.5px] bg-transparent p-0 outline-none transition-colors hover:bg-accent focus-visible:shadow-[0_0_0_2px_var(--background),0_0_0_4px_var(--ring)] disabled:opacity-50",
					PRIORITY_RING[task.priority]
				)}
				disabled={isCompleting}
				onClick={() => onComplete(task)}
				type="button"
			>
				<IconCheck
					aria-hidden
					className="size-3 opacity-0 transition-opacity group-hover/task:opacity-60"
				/>
			</button>
			<button
				className="flex min-w-0 flex-1 cursor-pointer flex-col gap-0.5 border-0 bg-transparent p-0 text-left text-foreground outline-none focus-visible:shadow-[0_0_0_2px_var(--ring)]"
				onClick={() => onOpen(task)}
				type="button"
			>
				<span className="desk:text-sm text-[length:var(--m-text-body)] leading-5">
					{task.title}
				</span>
				{hasMeta && (
					<span className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-muted-foreground text-xs">
						{task.scheduledDate && (
							<span
								className={cn(
									"inline-flex items-center gap-1",
									TONE_CLASS[dueTone(task.scheduledDate, today)]
								)}
							>
								<IconCalendarEvent aria-hidden className="size-3.5" />
								{formatDay(task.scheduledDate, today)}
							</span>
						)}
						{task.deadline && (
							<span
								className={cn(
									"inline-flex items-center gap-1",
									TONE_CLASS[dueTone(task.deadline, today)]
								)}
							>
								<IconFlag aria-hidden className="size-3.5" />
								{formatDay(task.deadline, today)}まで
							</span>
						)}
						{task.recurrence && (
							<span className="inline-flex items-center gap-1">
								<IconRepeat aria-hidden className="size-3.5" />
								{formatRecurrence(task.recurrence)}
							</span>
						)}
						{task.estimateMinutes && (
							<span className="inline-flex items-center gap-1">
								<IconHourglass aria-hidden className="size-3.5" />
								{task.estimateMinutes}分
							</span>
						)}
						{task.labels.map((label) => (
							<span key={label.id}>{label.name}</span>
						))}
						{showProject && project && (
							<span className="inline-flex items-center gap-1">
								<span
									aria-hidden
									className={cn(
										"size-2 rounded-full",
										PROJECT_COLOR_CLASS[project.color]
									)}
								/>
								{projectPath(projects, project.id)}
							</span>
						)}
					</span>
				)}
			</button>
		</div>
	);
}
