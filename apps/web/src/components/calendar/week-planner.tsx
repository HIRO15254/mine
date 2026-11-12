import {
	type CollisionDetection,
	DndContext,
	type DragEndEvent,
	type DragMoveEvent,
	DragOverlay,
	type DragStartEvent,
	MouseSensor,
	pointerWithin,
	rectIntersection,
	TouchSensor,
	useSensor,
	useSensors,
} from "@dnd-kit/core";
import { IconChecklist } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { type CSSProperties, useState } from "react";
import { toast } from "sonner";

import { useTaskEditor } from "@/components/tasks/task-editor";
import { useTaskContext, useUpdateTask } from "@/components/tasks/use-tasks";
import { useIsDesk } from "@/hooks/use-media-query";
import { useNow } from "@/hooks/use-now";
import { useToday } from "@/hooks/use-today";
import { dayKey, formatDayLabel, rangeOfDays } from "@/lib/calendar-time";
import { type DropTarget, dropMinutes, placementForDrop } from "@/lib/day-grid";
import type { Project, Task } from "@/lib/tasks";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

import { CalendarError, CalendarLoading } from "./calendar-status";
import { TaskTray, type TrayFilter } from "./task-tray";
import { type DropPreview, TimeGrid, taskLength } from "./time-grid";

/** The column under the finger or pointer wins over the widest overlap. */
const pointerFirst: CollisionDetection = (args) => {
	const hits = pointerWithin(args);
	return hits.length > 0 ? hits : rectIntersection(args);
};

const draggedTask = (event: DragStartEvent | DragMoveEvent | DragEndEvent) =>
	event.active.data.current?.task as Task | undefined;

const dropTarget = (event: DragMoveEvent | DragEndEvent) =>
	event.over?.data.current as DropTarget | undefined;

/** Where the dragged task's top edge would land on a day column. */
function landing(
	event: DragMoveEvent | DragEndEvent,
	hourHeight: number
): DropPreview | null {
	const target = dropTarget(event);
	const rect = event.active.rect.current.translated;
	const task = draggedTask(event);
	if (!(target?.kind === "slot" && rect && task)) {
		return null;
	}
	const column = document
		.querySelector(`[data-day-column="${target.day}"]`)
		?.getBoundingClientRect();
	if (!column) {
		return null;
	}
	const length = taskLength(task);
	return {
		day: target.day,
		length,
		start: dropMinutes(rect.top - column.top, hourHeight, length),
	};
}

function samePreview(a: DropPreview | null, b: DropPreview | null): boolean {
	return a?.day === b?.day && a?.start === b?.start;
}

const WEEKDAY = new Intl.DateTimeFormat("ja-JP", { weekday: "short" });

/** The phone's day picker: one day of the week at a time. */
function DayStrip({
	days,
	onSelect,
	selected,
	today,
}: {
	days: Date[];
	onSelect: (day: string) => void;
	selected: string;
	today: Date;
}) {
	return (
		<div className="grid grid-cols-7 gap-1" role="tablist">
			{days.map((day) => {
				const key = dayKey(day);
				const isToday = key === dayKey(today);
				return (
					<button
						aria-label={formatDayLabel(day)}
						aria-selected={key === selected}
						className={cn(
							"press flex h-[3.25rem] cursor-pointer flex-col items-center justify-center gap-0.5 rounded-lg border border-transparent bg-transparent text-muted-foreground text-xs",
							key === selected &&
								"border-ring bg-primary-soft text-primary-text shadow-[var(--glow)]"
						)}
						key={key}
						onClick={() => onSelect(key)}
						role="tab"
						type="button"
					>
						{WEEKDAY.format(day)}
						<span
							className={cn(
								"font-semibold text-[length:var(--m-text-body)] text-foreground tabular-nums",
								(isToday || key === selected) && "text-primary-text"
							)}
						>
							{day.getDate()}
						</span>
					</button>
				);
			})}
		</div>
	);
}

/** The chip that follows the pointer while a task is dragged. */
function TaskOverlay({
	projects,
	task,
	width,
}: {
	projects: Project[];
	task: Task;
	width: number;
}) {
	const project = projects.find((item) => item.id === task.projectId);
	return (
		<div
			className="flex cursor-grabbing items-center gap-1 rounded-md border border-[var(--c)] bg-card px-1.5 py-1 text-foreground text-xs shadow-[var(--shadow-lg)]"
			style={
				{
					"--c": project ? `var(--${project.color})` : "var(--primary-text)",
					width,
				} as CSSProperties
			}
		>
			<IconChecklist aria-hidden className="size-3 shrink-0 text-[var(--c)]" />
			<span className="min-w-0 flex-1 truncate font-medium">{task.title}</span>
		</div>
	);
}

/**
 * The week as a time grid with the tasks to place beside it. On the phone
 * one day at a time, picked from the strip above. Dragging a task onto the
 * grid, a 終日 row or back to the tray changes its day and time; what a drop
 * means is decided by `placementForDrop`.
 */
export function WeekPlanner({
	days,
	today,
	weekStart,
}: {
	days: Date[];
	today: Date;
	weekStart: Date;
}) {
	const isDesk = useIsDesk();
	const now = useNow(30_000);
	const hourHeight = isDesk ? 48 : 56;
	const { labels, projects } = useTaskContext();
	const { editor, openEdit } = useTaskEditor({ labels, projects });
	const events = useQuery({
		...trpc.calendar.events.queryOptions(rangeOfDays(weekStart, 7)),
		retry: false,
		staleTime: 60_000,
	});
	const todayString = useToday();
	const openTasks = useQuery(
		trpc.task.list.queryOptions({ today: todayString, view: "open" })
	);
	const todayTasks = useQuery(
		trpc.task.list.queryOptions({ today: todayString, view: "today" })
	);
	const [filter, setFilter] = useState<TrayFilter>("today");
	const [selected, setSelected] = useState(() => {
		const key = dayKey(today);
		return days.some((day) => dayKey(day) === key) ? key : dayKey(weekStart);
	});
	const [preview, setPreview] = useState<DropPreview | null>(null);
	const [dragging, setDragging] = useState<{
		task: Task;
		width: number;
	} | null>(null);
	// The task moves in the cached lists at once, and back if the server refuses.
	const update = useUpdateTask(() => toast.error("タスクを動かせませんでした"));
	const sensors = useSensors(
		useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
		useSensor(TouchSensor, {
			activationConstraint: { delay: 250, tolerance: 8 },
		})
	);

	const visibleDays = isDesk
		? days
		: days.filter((day) => dayKey(day) === selected);
	const shown = new Set(visibleDays.map(dayKey));
	const tasks = openTasks.data ?? [];
	// The tray holds what is not on the grid: no time, and not in a 終日 row.
	const trayTasks = (
		(filter === "today" ? todayTasks.data : openTasks.data) ?? []
	).filter(
		(task) =>
			!(
				task.scheduledTime ||
				(task.scheduledDate && shown.has(task.scheduledDate))
			)
	);

	const onDragStart = (event: DragStartEvent) => {
		const task = draggedTask(event);
		if (task) {
			setDragging({
				task,
				width: Math.min(event.active.rect.current.initial?.width ?? 176, 220),
			});
		}
	};

	const onDragMove = (event: DragMoveEvent) => {
		const next = landing(event, hourHeight);
		setPreview((current) => (samePreview(current, next) ? current : next));
	};

	const onDragEnd = (event: DragEndEvent) => {
		setPreview(null);
		setDragging(null);
		const dragged = draggedTask(event);
		const target = dropTarget(event);
		if (!(dragged && target)) {
			return;
		}
		// The dragged copy can be older than the cache if it was just moved.
		const task = tasks.find((item) => item.id === dragged.id) ?? dragged;
		const placement = placementForDrop(
			task,
			target,
			landing(event, hourHeight)?.start ?? null
		);
		if (placement) {
			update.mutate({ id: task.id, ...placement });
		}
	};

	const tray = (
		<TaskTray
			filter={filter}
			layout={isDesk ? "column" : "row"}
			onFilterChange={setFilter}
			onOpenTask={openEdit}
			projects={projects}
			tasks={trayTasks}
		/>
	);

	return (
		<DndContext
			collisionDetection={pointerFirst}
			onDragCancel={() => {
				setPreview(null);
				setDragging(null);
			}}
			onDragEnd={onDragEnd}
			onDragMove={onDragMove}
			onDragStart={onDragStart}
			sensors={sensors}
		>
			<div
				className="grid desk:grid-cols-[minmax(0,1fr)_15rem] items-start desk:gap-5 gap-3"
				style={
					// The grid's day and 終日 rows stick under the page header, and on
					// the phone under the tray row too.
					{
						"--grid-head-top": isDesk
							? "3rem"
							: "calc(var(--m-navbar-height) + 3rem)",
					} as CSSProperties
				}
			>
				<div className="flex min-w-0 flex-col gap-3">
					{isDesk ? null : (
						<DayStrip
							days={days}
							onSelect={setSelected}
							selected={selected}
							today={today}
						/>
					)}
					{isDesk ? null : tray}
					{events.isError ? (
						<CalendarError
							error={events.error}
							onRetry={() => events.refetch()}
						/>
					) : null}
					{events.isPending ? <CalendarLoading /> : null}
					<TimeGrid
						days={visibleDays}
						events={events.data?.events ?? []}
						hourHeight={hourHeight}
						now={now}
						onOpenTask={openEdit}
						preview={preview}
						projects={projects}
						showDayHeader={isDesk}
						tasks={tasks}
						today={today}
					/>
				</div>
				{isDesk ? <div className="sticky top-16">{tray}</div> : null}
			</div>
			<DragOverlay dropAnimation={null}>
				{dragging ? (
					<TaskOverlay
						projects={projects}
						task={dragging.task}
						width={dragging.width}
					/>
				) : null}
			</DragOverlay>
			{editor}
		</DndContext>
	);
}
