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
import {
	IconChecklist,
	IconChevronLeft,
	IconChevronRight,
} from "@tabler/icons-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { type CSSProperties, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Page } from "@/components/app-shell/page";
import {
	CalendarError,
	CalendarLoading,
} from "@/components/calendar/calendar-status";
import { TaskTray, type TrayFilter } from "@/components/calendar/task-tray";
import {
	type DropPreview,
	TimeGrid,
	taskLength,
} from "@/components/calendar/time-grid";
import { useTaskEditor } from "@/components/tasks/task-editor";
import {
	useInvalidateTasks,
	useTaskContext,
} from "@/components/tasks/use-tasks";
import { Button } from "@/components/ui/button/button";
import { IconButton } from "@/components/ui/icon-button/icon-button";
import { useIsDesk } from "@/hooks/use-media-query";
import {
	addDays,
	dayKey,
	formatDayLabel,
	formatWeekLabel,
	parseDayKey,
	rangeOfDays,
	startOfDay,
	startOfWeek,
} from "@/lib/calendar-time";
import { dropMinutes, formatTime } from "@/lib/day-grid";
import { type Project, type Task, todayKey } from "@/lib/tasks";
import { cn } from "@/lib/utils";
import { trpc } from "@/utils/trpc";

export const Route = createFileRoute("/_app/calendar")({
	validateSearch: (search: Record<string, unknown>): { week?: string } =>
		typeof search.week === "string" && parseDayKey(search.week)
			? { week: search.week }
			: {},
	component: CalendarPage,
});

function CalendarPage() {
	const { week } = Route.useSearch();
	const navigate = useNavigate({ from: Route.fullPath });
	const today = startOfDay(new Date());
	const weekStart = useMemo(
		() => startOfWeek(parseDayKey(week) ?? new Date()),
		[week]
	);
	const days = useMemo(
		() => Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)),
		[weekStart]
	);
	const isCurrentWeek = dayKey(weekStart) === dayKey(startOfWeek(today));

	const goToWeek = (start: Date | null) =>
		navigate({ search: start ? { week: dayKey(start) } : {} });

	return (
		<Page
			actions={
				<>
					<Button
						disabled={isCurrentWeek}
						onClick={() => goToWeek(null)}
						size="sm"
						type="button"
						variant="outline"
					>
						今週
					</Button>
					<IconButton
						label="前の週"
						onClick={() => goToWeek(addDays(weekStart, -7))}
					>
						<IconChevronLeft aria-hidden />
					</IconButton>
					<IconButton
						label="次の週"
						onClick={() => goToWeek(addDays(weekStart, 7))}
					>
						<IconChevronRight aria-hidden />
					</IconButton>
				</>
			}
			className="desk:max-w-[1280px]"
			title={formatWeekLabel(weekStart)}
		>
			<WeekPlanner
				days={days}
				key={dayKey(weekStart)}
				today={today}
				weekStart={weekStart}
			/>
		</Page>
	);
}

/** The current time, refreshed every 30 seconds for the line on the grid. */
function useMinuteClock(): number {
	const [now, setNow] = useState(() => Date.now());
	useEffect(() => {
		const timer = window.setInterval(() => setNow(Date.now()), 30_000);
		return () => window.clearInterval(timer);
	}, []);
	return now;
}

type Placement = Pick<Task, "scheduledDate" | "scheduledTime">;

interface DropTarget {
	day?: string;
	kind: "allday" | "slot" | "tray";
}

/** The column under the finger or pointer wins over the widest overlap. */
const pointerFirst: CollisionDetection = (args) => {
	const hits = pointerWithin(args);
	return hits.length > 0 ? hits : rectIntersection(args);
};

/** Where the dragged task's top edge would land on a day column. */
function landing(
	event: DragMoveEvent | DragEndEvent,
	hourHeight: number
): DropPreview | null {
	const target = event.over?.data.current as DropTarget | undefined;
	const rect = event.active.rect.current.translated;
	const task = event.active.data.current?.task as Task | undefined;
	if (!(target?.kind === "slot" && target.day && rect && task)) {
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

const WEEKDAY = new Intl.DateTimeFormat("ja-JP", { weekday: "short" });

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
 * one day at a time, picked from the strip above.
 */
function WeekPlanner({
	days,
	today,
	weekStart,
}: {
	days: Date[];
	today: Date;
	weekStart: Date;
}) {
	const isDesk = useIsDesk();
	const now = useMinuteClock();
	const hourHeight = isDesk ? 48 : 56;
	const { labels, projects } = useTaskContext();
	const { editor, openEdit } = useTaskEditor({ labels, projects });
	const invalidate = useInvalidateTasks();
	const events = useQuery({
		...trpc.calendar.events.queryOptions(rangeOfDays(weekStart, 7)),
		retry: false,
		staleTime: 60_000,
	});
	const todayString = todayKey();
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
	const [moved, setMoved] = useState<Record<string, Placement>>({});
	const [preview, setPreview] = useState<DropPreview | null>(null);
	const [dragging, setDragging] = useState<{
		task: Task;
		width: number;
	} | null>(null);
	const update = useMutation(
		trpc.task.update.mutationOptions({
			onError: () => toast.error("タスクを動かせませんでした"),
			onSettled: async (_data, _error, input) => {
				await invalidate();
				setMoved(({ [input.id]: _done, ...rest }) => rest);
			},
		})
	);
	const sensors = useSensors(
		useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
		useSensor(TouchSensor, {
			activationConstraint: { delay: 250, tolerance: 8 },
		})
	);

	const place = (list: Task[] | undefined) =>
		(list ?? []).map((task) =>
			moved[task.id] ? { ...task, ...moved[task.id] } : task
		);
	const visibleDays = isDesk
		? days
		: days.filter((day) => dayKey(day) === selected);
	const shown = new Set(visibleDays.map(dayKey));
	const tasks = place(openTasks.data);
	const trayTasks = place(
		filter === "today" ? todayTasks.data : openTasks.data
	).filter(
		(task) =>
			!(
				task.scheduledTime ||
				(task.scheduledDate && shown.has(task.scheduledDate))
			)
	);

	const move = (task: Task, placement: Placement) => {
		if (
			task.scheduledDate === placement.scheduledDate &&
			task.scheduledTime === placement.scheduledTime
		) {
			return;
		}
		setMoved((current) => ({ ...current, [task.id]: placement }));
		update.mutate({ id: task.id, ...placement });
	};

	const onDragStart = (event: DragStartEvent) => {
		const task = event.active.data.current?.task as Task | undefined;
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
		const task = event.active.data.current?.task as Task | undefined;
		const target = event.over?.data.current as DropTarget | undefined;
		if (!(task && target)) {
			return;
		}
		const drop = landing(event, hourHeight);
		const current = moved[task.id] ? { ...task, ...moved[task.id] } : task;
		if (target.kind === "slot" && drop) {
			move(current, {
				scheduledDate: drop.day,
				scheduledTime: formatTime(drop.start),
			});
		} else if (target.kind === "allday" && target.day) {
			move(current, { scheduledDate: target.day, scheduledTime: null });
		} else if (target.kind === "tray" && current.scheduledTime) {
			move(current, {
				scheduledDate: current.scheduledDate,
				scheduledTime: null,
			});
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
