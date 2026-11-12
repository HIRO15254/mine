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
import { IconCalendarEvent, IconChecklist } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { type CSSProperties, type ReactNode, useState } from "react";
import { toast } from "sonner";

import { useTaskEditor } from "@/components/tasks/task-editor";
import { useTaskContext, useUpdateTask } from "@/components/tasks/use-tasks";
import { useEntryEditor } from "@/components/time/entry-editor";
import { useIsDesk } from "@/hooks/use-media-query";
import { useNow } from "@/hooks/use-now";
import { useToday } from "@/hooks/use-today";
import {
	addDays,
	type DisplayEvent,
	dayKey,
	formatDayLabel,
	parseDayKey,
	rangeOfDays,
} from "@/lib/calendar-time";
import { type DropTarget, dropMinutes, placementForDrop } from "@/lib/day-grid";
import type { Project, Task } from "@/lib/tasks";
import { currentTimeZone } from "@/lib/time";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

import { CalendarError, CalendarLoading } from "./calendar-status";
import {
	daysBetween,
	type EventTiming,
	movedTo,
	shiftedByDays,
} from "./event-draft";
import type { useEventEditor } from "./event-editor";
import { DayAgenda, MonthGrid } from "./month-grid";
import { TaskTray, type TrayFilter } from "./task-tray";
import {
	type DropPreview,
	type GridActions,
	TimeGrid,
	taskLength,
} from "./time-grid";
import { useCalendarEvents, useUpdateEvent } from "./use-events";

export type CalendarView = "month" | "week";

/** The column under the finger or pointer wins over the widest overlap. */
const pointerFirst: CollisionDetection = (args) => {
	const hits = pointerWithin(args);
	return hits.length > 0 ? hits : rectIntersection(args);
};

type Dragged =
	| { kind: "task"; task: Task }
	| { event: DisplayEvent; fromDay: string | null; kind: "event" };

function draggedItem(
	event: DragStartEvent | DragMoveEvent | DragEndEvent
): Dragged | null {
	const data = event.active.data.current as
		| { event?: DisplayEvent; fromDay?: string; task?: Task }
		| undefined;
	if (data?.task) {
		return { kind: "task", task: data.task };
	}
	if (data?.event) {
		return { event: data.event, fromDay: data.fromDay ?? null, kind: "event" };
	}
	return null;
}

/** How many minutes a dragged item takes on the grid. */
function draggedLength(item: Dragged): number {
	if (item.kind === "task") {
		return taskLength(item.task);
	}
	const minutes =
		(Date.parse(item.event.end) - Date.parse(item.event.start)) / 60_000;
	return Math.max(Math.round(minutes), 15);
}

const dropTarget = (event: DragMoveEvent | DragEndEvent) =>
	event.over?.data.current as DropTarget | undefined;

/** Where the dragged item's top edge would land on a day column. */
function landing(
	event: DragMoveEvent | DragEndEvent,
	hourHeight: number
): DropPreview | null {
	const target = dropTarget(event);
	const rect = event.active.rect.current.translated;
	const item = draggedItem(event);
	if (!(target?.kind === "slot" && rect && item)) {
		return null;
	}
	if (item.kind === "event" && item.event.allDay) {
		return null;
	}
	const column = document
		.querySelector(`[data-day-column="${target.day}"]`)
		?.getBoundingClientRect();
	if (!column) {
		return null;
	}
	const length = draggedLength(item);
	return {
		day: target.day,
		length,
		start: dropMinutes(rect.top - column.top, hourHeight, length),
	};
}

function samePreview(a: DropPreview | null, b: DropPreview | null): boolean {
	return a?.day === b?.day && a?.start === b?.start;
}

/**
 * What a drop does to an event: a timed one moves to the time it lands on,
 * and on a 終日 row or a day of the month either kind moves by whole days.
 * Null when nothing changes or the drop does not fit the event.
 */
function eventMove(
	item: Extract<Dragged, { kind: "event" }>,
	target: DropTarget,
	start: number | null
): EventTiming | null {
	const zone = currentTimeZone();
	const { event } = item;
	if (target.kind === "slot") {
		const day = parseDayKey(target.day);
		if (event.allDay || start === null || !day) {
			return null;
		}
		const when = movedTo(event, day, start, zone);
		return Date.parse(when.start) === Date.parse(event.start) ? null : when;
	}
	if ((target.kind === "allday" && event.allDay) || target.kind === "day") {
		const from =
			item.fromDay ??
			(event.allDay ? event.start : dayKey(new Date(Date.parse(event.start))));
		const days = daysBetween(from, target.day);
		return days === 0 ? null : shiftedByDays(event, days, zone);
	}
	return null;
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

/** The chip that follows the pointer while a task or event is dragged. */
function DragChip({
	color,
	icon,
	title,
	width,
}: {
	color: string;
	icon: ReactNode;
	title: string;
	width: number;
}) {
	return (
		<div
			className="flex cursor-grabbing items-center gap-1 rounded-md border border-[var(--c)] bg-card px-1.5 py-1 text-foreground text-xs shadow-[var(--shadow-lg)] [&_svg]:size-3 [&_svg]:shrink-0 [&_svg]:text-[var(--c)]"
			style={{ "--c": color, width } as CSSProperties}
		>
			{icon}
			<span className="min-w-0 flex-1 truncate font-medium">{title}</span>
		</div>
	);
}

function DraggedChip({
	item,
	projects,
	width,
}: {
	item: Dragged;
	projects: Project[];
	width: number;
}) {
	if (item.kind === "event") {
		return (
			<DragChip
				color={item.event.color}
				icon={<IconCalendarEvent aria-hidden />}
				title={item.event.title || "（タイトルなし）"}
				width={width}
			/>
		);
	}
	const project = projects.find((row) => row.id === item.task.projectId);
	return (
		<DragChip
			color={project ? `var(--${project.color})` : "var(--primary-text)"}
			icon={<IconChecklist aria-hidden />}
			title={item.task.title}
			width={width}
		/>
	);
}

/**
 * What the tray lists: tasks not on the calendar (no time in the week view,
 * and not on a day shown), of the period (planned or due in it, or on Today
 * while today is in it) unless every open task is asked for.
 */
export function tasksForTray({
	filter,
	period,
	shown,
	tasks,
	today,
	todayTasks,
	view,
}: {
	filter: TrayFilter;
	period: Date[];
	shown: Date[];
	tasks: Task[];
	today: string;
	todayTasks: Task[];
	view: CalendarView;
}): Task[] {
	const shownKeys = new Set(shown.map(dayKey));
	const periodKeys = new Set(period.map(dayKey));
	const dueToday = new Set(todayTasks.map((task) => task.id));
	const inPeriod = (task: Task) =>
		(task.scheduledDate !== null && periodKeys.has(task.scheduledDate)) ||
		(task.deadline !== null && periodKeys.has(task.deadline)) ||
		(periodKeys.has(today) && dueToday.has(task.id));
	const onCalendar = (task: Task) =>
		(view === "week" && task.scheduledTime !== null) ||
		(task.scheduledDate !== null && shownKeys.has(task.scheduledDate));
	return tasks.filter(
		(task) => !onCalendar(task) && (filter === "all" || inPeriod(task))
	);
}

/** What the tray calls the period on screen, and how to place a task. */
function trayWords(view: CalendarView, isDesk: boolean) {
	if (view === "month") {
		return {
			hint: "日付へドラッグすると、その日に置けます。戻すと時刻だけ外れます",
			period: "この月",
		};
	}
	return {
		hint: "時間の欄へドラッグすると、その時刻に置けます。戻すと時刻だけ外れます",
		period: isDesk ? "この週" : "この日",
	};
}

/** The day the phone starts on: today when it is on screen, else the first. */
function firstSelected(days: Date[], month: Date | null, today: Date): string {
	const key = dayKey(today);
	const inRange = days.some(
		(day) =>
			dayKey(day) === key &&
			(month === null || day.getMonth() === month.getMonth())
	);
	return inRange ? key : dayKey(month ?? days[0] ?? today);
}

/** The drag state of the planner and what a drop changes. */
function usePlannerDrag(hourHeight: number, tasks: Task[]) {
	const [preview, setPreview] = useState<DropPreview | null>(null);
	const [dragging, setDragging] = useState<{
		item: Dragged;
		width: number;
	} | null>(null);
	// The task moves in the cached lists at once, and back if the server refuses.
	const updateTask = useUpdateTask(() =>
		toast.error("タスクを動かせませんでした")
	);
	const updateEvent = useUpdateEvent();

	const onDragStart = (event: DragStartEvent) => {
		const item = draggedItem(event);
		if (item) {
			setDragging({
				item,
				width: Math.min(event.active.rect.current.initial?.width ?? 176, 220),
			});
		}
	};

	const onDragMove = (event: DragMoveEvent) => {
		const next = landing(event, hourHeight);
		setPreview((current) => (samePreview(current, next) ? current : next));
	};

	const onDragCancel = () => {
		setPreview(null);
		setDragging(null);
	};

	const onDragEnd = (event: DragEndEvent) => {
		onDragCancel();
		const item = draggedItem(event);
		const target = dropTarget(event);
		if (!(item && target)) {
			return;
		}
		const start = landing(event, hourHeight)?.start ?? null;
		if (item.kind === "event") {
			const when =
				target.kind === "tray" ? null : eventMove(item, target, start);
			if (when) {
				updateEvent.mutate({
					calendarId: item.event.calendarId,
					eventId: item.event.id,
					when,
				});
			}
			return;
		}
		// The dragged copy can be older than the cache if it was just moved.
		const task = tasks.find((row) => row.id === item.task.id) ?? item.task;
		const placement = placementForDrop(task, target, start);
		if (placement) {
			updateTask.mutate({ id: task.id, ...placement });
		}
	};

	return {
		dragging,
		onDragCancel,
		onDragEnd,
		onDragMove,
		onDragStart,
		preview,
	};
}

/** The month: on the desk the grid alone, on the phone the picked day below it. */
function MonthView({
	actions,
	days,
	events,
	isDesk,
	month,
	onPickDay,
	onSelect,
	projects,
	selected,
	tasks,
	today,
}: {
	actions: GridActions;
	days: Date[];
	events: DisplayEvent[];
	isDesk: boolean;
	month: Date;
	onPickDay: (day: Date) => void;
	onSelect: (day: string) => void;
	projects: Project[];
	selected: string;
	tasks: Task[];
	today: Date;
}) {
	return (
		<>
			<MonthGrid
				actions={actions}
				compact={!isDesk}
				days={days}
				events={events}
				month={month}
				onPickDay={(day) => (isDesk ? onPickDay(day) : onSelect(dayKey(day)))}
				projects={projects}
				selected={isDesk ? null : selected}
				tasks={tasks}
				today={today}
			/>
			{isDesk ? null : (
				<DayAgenda
					actions={actions}
					day={parseDayKey(selected) ?? today}
					events={events}
					projects={projects}
					tasks={tasks}
				/>
			)}
		</>
	);
}

/**
 * The calendar: a week as a time grid or a month as days, with the tasks to
 * place beside it. On the phone the week shows one day at a time, picked
 * from the strip above, and the month shows the picked day's list below.
 *
 * Tasks and the events of calendars the person can edit can be dragged:
 * onto the grid for a time, onto a 終日 row or a day of the month for a day,
 * or (tasks) back to the tray. A click on an empty place adds an event.
 */
export function CalendarPlanner({
	days,
	eventEditor,
	month,
	onPickDay,
	today,
	view,
}: {
	/** The days on screen: a week, or the month's whole weeks. */
	days: Date[];
	eventEditor: ReturnType<typeof useEventEditor>;
	/** The first of the month in the month view; null in the week view. */
	month: Date | null;
	/** A day picked in the month view, to see its week. */
	onPickDay: (day: Date) => void;
	today: Date;
	view: CalendarView;
}) {
	const isDesk = useIsDesk();
	const now = useNow(30_000);
	const hourHeight = isDesk ? 48 : 56;
	const { labels, projects } = useTaskContext();
	const { editor: taskEditor, openEdit } = useTaskEditor({ labels, projects });
	const { editor: entryEditor, openEdit: openEntry } = useEntryEditor(projects);
	const first = days[0] ?? today;
	const events = useCalendarEvents(rangeOfDays(first, days.length));
	const entries = useQuery({
		...trpc.time.list.queryOptions({
			from: first.getTime(),
			to: addDays(first, days.length).getTime(),
		}),
		enabled: view === "week",
	});
	const todayString = useToday();
	const openTasks = useQuery(
		trpc.task.list.queryOptions({ today: todayString, view: "open" })
	);
	const todayTasks = useQuery(
		trpc.task.list.queryOptions({ today: todayString, view: "today" })
	);
	const [filter, setFilter] = useState<TrayFilter>("period");
	const [selected, setSelected] = useState(() =>
		firstSelected(days, month, today)
	);
	const sensors = useSensors(
		useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
		useSensor(TouchSensor, {
			activationConstraint: { delay: 250, tolerance: 8 },
		})
	);

	const visibleDays =
		view === "week" && !isDesk
			? days.filter((day) => dayKey(day) === selected)
			: days;
	const tasks = openTasks.data ?? [];
	const trayTasks = tasksForTray({
		filter,
		period: month
			? days.filter((day) => day.getMonth() === month.getMonth())
			: visibleDays,
		shown: visibleDays,
		tasks,
		today: todayString,
		todayTasks: todayTasks.data ?? [],
		view,
	});
	const words = trayWords(view, isDesk);

	const actions: GridActions = {
		canEdit: eventEditor.canEdit,
		onCreate: eventEditor.openNew,
		onEditEntry: openEntry,
		onOpenEvent: eventEditor.openEvent,
		onOpenTask: openEdit,
	};

	const drag = usePlannerDrag(hourHeight, tasks);

	const tray = (
		<TaskTray
			filter={filter}
			hint={words.hint}
			layout={isDesk ? "column" : "row"}
			onFilterChange={setFilter}
			onOpenTask={openEdit}
			periodLabel={words.period}
			projects={projects}
			tasks={trayTasks}
		/>
	);
	const eventList = events.data?.events ?? [];

	const calendar = month ? (
		<MonthView
			actions={actions}
			days={days}
			events={eventList}
			isDesk={isDesk}
			month={month}
			onPickDay={onPickDay}
			onSelect={setSelected}
			projects={projects}
			selected={selected}
			tasks={tasks}
			today={today}
		/>
	) : (
		<TimeGrid
			actions={actions}
			days={visibleDays}
			entries={entries.data ?? []}
			events={eventList}
			hourHeight={hourHeight}
			now={now}
			preview={drag.preview}
			projects={projects}
			showDayHeader={isDesk}
			tasks={tasks}
			today={today}
		/>
	);

	return (
		<DndContext
			collisionDetection={pointerFirst}
			onDragCancel={drag.onDragCancel}
			onDragEnd={drag.onDragEnd}
			onDragMove={drag.onDragMove}
			onDragStart={drag.onDragStart}
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
					{isDesk || view === "month" ? null : (
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
					{calendar}
				</div>
				{isDesk ? <div className="sticky top-16">{tray}</div> : null}
			</div>
			<DragOverlay dropAnimation={null}>
				{drag.dragging ? (
					<DraggedChip
						item={drag.dragging.item}
						projects={projects}
						width={drag.dragging.width}
					/>
				) : null}
			</DragOverlay>
			{taskEditor}
			{entryEditor}
		</DndContext>
	);
}
