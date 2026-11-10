import { useDraggable, useDroppable } from "@dnd-kit/core";
import { IconChecklist } from "@tabler/icons-react";
import { type CSSProperties, useEffect, useRef } from "react";

import {
	type DisplayEvent,
	dayKey,
	eventsOnDay,
	formatEventTime,
} from "@/lib/calendar-time";
import {
	DAY_MINUTES,
	DEFAULT_TASK_MINUTES,
	formatClockLabel,
	formatTime,
	layoutDay,
	minutesIntoDay,
	type PlacedItem,
	parseTime,
	timedEventsOn,
} from "@/lib/day-grid";
import type { Project, Task } from "@/lib/tasks";
import { cn } from "@/lib/utils";

/** Blocks shorter than this put their time beside the title. */
const SHORT_MINUTES = 45;
const HOURS = Array.from({ length: 24 }, (_, hour) => hour);
const weekday = new Intl.DateTimeFormat("ja-JP", { weekday: "short" });

/** Where a dragged task would land, drawn as a ghost block. */
export interface DropPreview {
	day: string;
	length: number;
	start: number;
}

export function taskLength(task: Task): number {
	return task.estimateMinutes ?? DEFAULT_TASK_MINUTES;
}

function projectHue(task: Task, projects: Project[]): string {
	const project = projects.find((item) => item.id === task.projectId);
	return project ? `var(--${project.color})` : "var(--primary-text)";
}

/** A task the person can drag onto the grid, as a chip or a timed block. */
export function DraggableTask({
	className,
	onOpen,
	projects,
	short = false,
	style,
	task,
	variant,
}: {
	className?: string;
	onOpen: (task: Task) => void;
	projects: Project[];
	/** A block too short for two lines puts its time beside the title. */
	short?: boolean;
	style?: CSSProperties;
	task: Task;
	variant: "block" | "chip";
}) {
	const { attributes, isDragging, listeners, setNodeRef } = useDraggable({
		data: { task },
		id: `task:${task.id}`,
	});
	const start = parseTime(task.scheduledTime);
	return (
		<button
			{...attributes}
			{...listeners}
			aria-roledescription="ドラッグできるタスク"
			className={cn(
				"flex min-w-0 cursor-grab touch-manipulation items-start gap-1 border border-[color-mix(in_srgb,var(--c)_70%,transparent)] border-dashed bg-card text-left text-foreground outline-none focus-visible:shadow-[0_0_0_2px_var(--ring)] active:cursor-grabbing",
				variant === "block"
					? "@container flex-col gap-0 overflow-hidden rounded-md px-1.5 py-0.5 text-xs data-[short]:flex-row data-[short]:items-center data-[short]:gap-1.5 data-[short]:py-0"
					: "rounded-md px-1.5 py-1 text-xs",
				isDragging && "opacity-40",
				className
			)}
			data-short={short || undefined}
			data-slot="calendar-task"
			onClick={() => onOpen(task)}
			ref={setNodeRef}
			style={{ "--c": projectHue(task, projects), ...style } as CSSProperties}
			type="button"
		>
			<span className="flex w-full min-w-0 items-center gap-1">
				<IconChecklist
					aria-hidden
					className="size-3 shrink-0 text-[var(--c)]"
				/>
				<span className="min-w-0 flex-1 truncate font-medium">
					{task.title}
				</span>
			</span>
			{variant === "block" && start !== null ? (
				<span
					className={cn(
						"shrink-0 text-[11px] text-muted-foreground tabular-nums",
						short && "@[9rem]:inline hidden"
					)}
				>
					{formatTime(start)}–{formatTime(start + taskLength(task))}
				</span>
			) : null}
		</button>
	);
}

function blockStyle(item: PlacedItem, hourHeight: number): CSSProperties {
	const length = Math.max(item.end - item.start, 20);
	return {
		height: Math.max((length / 60) * hourHeight - 2, 16),
		left: `calc(${(item.column / item.columns) * 100}% + 2px)`,
		top: (item.start / 60) * hourHeight + 1,
		width: `calc(${100 / item.columns}% - 4px)`,
	};
}

function EventBlock({
	event,
	short,
	style,
	time,
}: {
	event: DisplayEvent;
	short: boolean;
	style: CSSProperties;
	time: string;
}) {
	const className = cn(
		"@container absolute z-[1] flex flex-col overflow-hidden rounded-md border-l-[3px] px-1.5 py-0.5 text-foreground text-xs no-underline",
		short && "flex-row items-center gap-1.5 py-0"
	);
	const look = {
		...style,
		backgroundColor: `color-mix(in srgb, ${event.color} 18%, var(--card))`,
		borderLeftColor: event.color,
	};
	const content = (
		<>
			<span className={cn("truncate font-medium", short && "min-w-0 flex-1")}>
				{event.title || "（タイトルなし）"}
			</span>
			<span
				className={cn(
					"truncate text-[11px] text-muted-foreground tabular-nums",
					short && "@[9rem]:inline hidden shrink-0"
				)}
			>
				{time}
				{event.location ? ` ${event.location}` : ""}
			</span>
		</>
	);
	if (!event.htmlLink) {
		return (
			<div className={className} data-slot="calendar-event" style={look}>
				{content}
			</div>
		);
	}
	return (
		<a
			className={cn(
				className,
				"outline-none hover:brightness-110 focus-visible:shadow-[0_0_0_2px_var(--ring)]"
			)}
			data-slot="calendar-event"
			href={event.htmlLink}
			rel="noopener"
			style={look}
			target="_blank"
		>
			{content}
		</a>
	);
}

function NowLine({
	minutes,
	hourHeight,
}: {
	hourHeight: number;
	minutes: number;
}) {
	return (
		<div
			aria-hidden
			className="pointer-events-none absolute inset-x-0 z-[3]"
			data-slot="now-line"
			style={{ top: (minutes / 60) * hourHeight }}
		>
			<div className="h-0.5 bg-[image:var(--prism)] shadow-[var(--glow)]" />
			<span className="absolute -top-[3px] -left-1 size-2 rounded-full bg-primary-text shadow-[0_0_8px_var(--primary-text)]" />
		</div>
	);
}

function DayColumn({
	day,
	events,
	hourHeight,
	now,
	onOpenTask,
	preview,
	projects,
	tasks,
}: {
	day: Date;
	events: DisplayEvent[];
	hourHeight: number;
	now: number | null;
	onOpenTask: (task: Task) => void;
	preview: DropPreview | null;
	projects: Project[];
	tasks: Task[];
}) {
	const key = dayKey(day);
	const { isOver, setNodeRef } = useDroppable({
		data: { day: key, kind: "slot" },
		id: `slot:${key}`,
	});
	const timedEvents = timedEventsOn(events, day);
	const timedTasks = tasks.flatMap((task) => {
		const start = parseTime(task.scheduledTime);
		return task.scheduledDate === key && start !== null
			? [{ end: start + taskLength(task), key: `task:${task.id}`, start, task }]
			: [];
	});
	const placed = new Map(
		layoutDay([...timedEvents, ...timedTasks]).map((item) => [item.key, item])
	);
	return (
		<div
			className={cn(
				"relative border-border-subtle border-l bg-[length:100%_var(--hour)] bg-[linear-gradient(to_bottom,var(--border-subtle)_1px,transparent_1px)]",
				isOver && "bg-primary-soft/40"
			)}
			data-day-column={key}
			ref={setNodeRef}
			style={{ height: 24 * hourHeight }}
		>
			{timedEvents.map((item) => {
				const place = placed.get(item.key);
				return place ? (
					<EventBlock
						event={item.event}
						key={item.key}
						short={item.end - item.start < SHORT_MINUTES}
						style={blockStyle(place, hourHeight)}
						time={formatEventTime(item.event, day)}
					/>
				) : null;
			})}
			{timedTasks.map((item) => {
				const place = placed.get(item.key);
				return place ? (
					<DraggableTask
						className="absolute z-[2]"
						key={item.key}
						onOpen={onOpenTask}
						projects={projects}
						short={item.end - item.start < SHORT_MINUTES}
						style={blockStyle(place, hourHeight)}
						task={item.task}
						variant="block"
					/>
				) : null;
			})}
			{preview && preview.day === key ? (
				<div
					aria-hidden
					className="pointer-events-none absolute inset-x-0.5 z-[4] flex items-start rounded-md border-2 border-primary-text border-dashed bg-primary-soft px-1.5 py-0.5 font-mono text-[11px] text-primary-text tabular-nums"
					data-slot="drop-preview"
					style={{
						height: (preview.length / 60) * hourHeight,
						top: (preview.start / 60) * hourHeight,
					}}
				>
					{formatTime(preview.start)}
				</div>
			) : null}
			{now === null ? null : <NowLine hourHeight={hourHeight} minutes={now} />}
		</div>
	);
}

function AllDayCell({
	day,
	events,
	onOpenTask,
	projects,
	tasks,
}: {
	day: Date;
	events: DisplayEvent[];
	onOpenTask: (task: Task) => void;
	projects: Project[];
	tasks: Task[];
}) {
	const key = dayKey(day);
	const { isOver, setNodeRef } = useDroppable({
		data: { day: key, kind: "allday" },
		id: `allday:${key}`,
	});
	const allDay = eventsOnDay(events, day).filter((event) => event.allDay);
	const untimed = tasks.filter(
		(task) =>
			task.scheduledDate === key && parseTime(task.scheduledTime) === null
	);
	return (
		<div
			className={cn(
				"flex min-h-8 min-w-0 flex-col gap-0.5 border-border-subtle border-l p-0.5",
				isOver && "bg-primary-soft/40"
			)}
			data-slot="all-day"
			ref={setNodeRef}
		>
			{allDay.map((event) => (
				<span
					className="truncate rounded-sm px-1.5 py-0.5 text-foreground text-xs"
					key={`${event.calendarId}:${event.id}`}
					style={{
						backgroundColor: `color-mix(in srgb, ${event.color} 22%, var(--card))`,
					}}
				>
					{event.title || "（タイトルなし）"}
				</span>
			))}
			{untimed.map((task) => (
				<DraggableTask
					key={task.id}
					onOpen={onOpenTask}
					projects={projects}
					task={task}
					variant="chip"
				/>
			))}
		</div>
	);
}

/**
 * Hours down the side, one column per day: events from the calendar, tasks
 * placed at a time, and a line at the current time. Tasks dropped on a
 * column take that time; dropped on the 終日 row, they keep only the day.
 */
export function TimeGrid({
	days,
	events,
	hourHeight,
	now,
	onOpenTask,
	preview,
	projects,
	showDayHeader,
	tasks,
	today,
}: {
	days: Date[];
	events: DisplayEvent[];
	hourHeight: number;
	now: number;
	onOpenTask: (task: Task) => void;
	preview: DropPreview | null;
	projects: Project[];
	showDayHeader: boolean;
	tasks: Task[];
	today: Date;
}) {
	const columns = {
		gridTemplateColumns: `2.75rem repeat(${days.length}, minmax(0, 1fr))`,
	};
	const todayKey = dayKey(today);
	const showsToday = days.some((day) => dayKey(day) === todayKey);
	const nowMinutes = Math.floor(minutesIntoDay(now, today));
	const anchor = useRef<HTMLDivElement>(null);
	const firstDay = dayKey(days[0] ?? today);
	const anchorMinutes = showsToday ? Math.max(nowMinutes - 90, 0) : 8 * 60;

	// Open at the current time (or the morning) instead of midnight.
	// biome-ignore lint/correctness/useExhaustiveDependencies: only when the shown days change
	useEffect(() => {
		anchor.current?.scrollIntoView({ block: "start" });
	}, [firstDay, days.length]);

	return (
		<div
			className="flex min-w-0 flex-col"
			data-slot="time-grid"
			style={{ "--hour": `${hourHeight}px` } as CSSProperties}
		>
			<div
				className="sticky top-[var(--grid-head-top)] z-[5] grid border-border border-b bg-background"
				style={columns}
			>
				{showDayHeader ? (
					<>
						<span />
						{days.map((day) => {
							const isToday = dayKey(day) === todayKey;
							return (
								<span
									className={cn(
										"flex items-baseline justify-center gap-1 border-border-subtle border-l py-1.5 text-muted-foreground text-xs",
										isToday && "text-primary-text"
									)}
									key={dayKey(day)}
								>
									{weekday.format(day)}
									<span
										className={cn(
											"font-semibold text-base text-foreground tabular-nums",
											isToday &&
												"text-primary-text [text-shadow:var(--glow-text)]"
										)}
									>
										{day.getDate()}
									</span>
								</span>
							);
						})}
					</>
				) : null}
				<span className="self-start pt-1.5 pr-1.5 text-right text-[11px] text-muted-foreground">
					終日
				</span>
				{days.map((day) => (
					<AllDayCell
						day={day}
						events={events}
						key={dayKey(day)}
						onOpenTask={onOpenTask}
						projects={projects}
						tasks={tasks}
					/>
				))}
			</div>
			<div className="relative grid" style={columns}>
				<div
					aria-hidden
					className="pointer-events-none absolute inset-x-0 h-0 scroll-mt-44"
					ref={anchor}
					style={{ top: (anchorMinutes / 60) * hourHeight }}
				/>
				<div className="relative" style={{ height: 24 * hourHeight }}>
					{HOURS.slice(1).map((hour) => (
						<span
							className="absolute right-1.5 -translate-y-1/2 font-mono text-[11px] text-muted-foreground tabular-nums"
							key={hour}
							style={{ top: hour * hourHeight }}
						>
							{hour}:00
						</span>
					))}
					{showsToday && nowMinutes >= 0 && nowMinutes < DAY_MINUTES ? (
						<span
							className="absolute right-1 z-[1] -translate-y-1/2 rounded-sm bg-background px-0.5 font-mono font-semibold text-[11px] text-primary-text tabular-nums [text-shadow:var(--glow-text)]"
							data-slot="now-label"
							style={{ top: (nowMinutes / 60) * hourHeight }}
						>
							{formatClockLabel(nowMinutes)}
						</span>
					) : null}
				</div>
				{days.map((day) => (
					<DayColumn
						day={day}
						events={events}
						hourHeight={hourHeight}
						key={dayKey(day)}
						now={dayKey(day) === todayKey ? nowMinutes : null}
						onOpenTask={onOpenTask}
						preview={preview}
						projects={projects}
						tasks={tasks}
					/>
				))}
			</div>
		</div>
	);
}
