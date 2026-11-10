import { useDroppable } from "@dnd-kit/core";
import { IconCircleCheck } from "@tabler/icons-react";
import { useId } from "react";

import {
	ToggleGroup,
	ToggleGroupItem,
} from "@/components/ui/toggle-group/toggle-group";
import type { Project, Task } from "@/lib/tasks";
import { cn } from "@/lib/utils";

import { DraggableTask } from "./time-grid";

export type TrayFilter = "all" | "today";

/**
 * Tasks without a time, to drag onto the calendar. Dropping a placed task
 * here takes its time away again.
 */
export function TaskTray({
	filter,
	layout,
	onFilterChange,
	onOpenTask,
	projects,
	tasks,
}: {
	filter: TrayFilter;
	layout: "column" | "row";
	onFilterChange: (filter: TrayFilter) => void;
	onOpenTask: (task: Task) => void;
	projects: Project[];
	tasks: Task[];
}) {
	const id = useId();
	const { isOver, setNodeRef } = useDroppable({
		data: { kind: "tray" },
		id: "tray",
	});
	const toggle = (
		<ToggleGroup
			aria-label="表示するタスク"
			className="shrink-0"
			onValueChange={(value) => {
				if (value) {
					onFilterChange(value as TrayFilter);
				}
			}}
			type="single"
			value={filter}
		>
			<ToggleGroupItem className="h-7 px-2.5 text-xs" value="today">
				今日
			</ToggleGroupItem>
			<ToggleGroupItem className="h-7 px-2.5 text-xs" value="all">
				すべて
			</ToggleGroupItem>
		</ToggleGroup>
	);
	const empty = (
		<p className="m-0 flex items-center gap-1.5 py-1 text-muted-foreground text-xs">
			<IconCircleCheck aria-hidden className="size-4 shrink-0" />
			置けるタスクはありません
		</p>
	);
	const chips = tasks.map((task) => (
		<li
			className={layout === "row" ? "w-40 shrink-0" : undefined}
			key={task.id}
		>
			<DraggableTask
				className="w-full"
				onOpen={onOpenTask}
				projects={projects}
				task={task}
				variant="chip"
			/>
		</li>
	));

	if (layout === "row") {
		// The phone keeps this row under the header while the hours scroll.
		return (
			<section
				aria-describedby={`${id}-hint`}
				aria-label="時間が決まっていないタスク"
				className={cn(
					"sticky top-[var(--m-navbar-height)] z-[6] -mx-3.5 flex h-12 min-w-0 items-center gap-2 border-border border-b bg-background px-3.5 transition-colors",
					isOver && "bg-primary-soft"
				)}
				data-slot="task-tray"
				ref={setNodeRef}
			>
				<span className="sr-only" id={`${id}-hint`}>
					長押しして時間の欄へ動かすと、その時刻に置けます
				</span>
				{toggle}
				{tasks.length === 0 ? (
					empty
				) : (
					<ul className="m-0 flex min-w-0 flex-1 list-none gap-1 overflow-x-auto p-0 [scrollbar-width:none]">
						{chips}
					</ul>
				)}
			</section>
		);
	}

	return (
		<section
			aria-label="時間が決まっていないタスク"
			className={cn(
				"flex min-w-0 flex-col gap-2 rounded-lg border border-border bg-card p-2.5 transition-colors",
				isOver && "border-primary-text bg-primary-soft"
			)}
			data-slot="task-tray"
			ref={setNodeRef}
		>
			<div className="flex items-center gap-2">
				<h2 className="m-0 flex-1 font-semibold text-sm">タスクを置く</h2>
				{toggle}
			</div>
			{tasks.length === 0 ? (
				empty
			) : (
				<ul className="m-0 flex list-none flex-col gap-1 p-0">{chips}</ul>
			)}
			<p className="m-0 text-[11px] text-muted-foreground">
				時間の欄へドラッグすると、その時刻に置けます。戻すと時刻だけ外れます
			</p>
		</section>
	);
}
