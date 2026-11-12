import { useDraggable, useDroppable } from "@dnd-kit/core";
import { IconChecklist, IconZoomIn, IconZoomOut } from "@tabler/icons-react";
import { type CSSProperties, type MouseEvent, useEffect, useRef } from "react";
import { IconButton } from "@/components/ui/icon-button/icon-button";
import {
	type DisplayEvent,
	dayKey,
	eventsOnDay,
	formatDayLabel,
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
	spanCss,
	timedEventsOn,
} from "@/lib/day-grid";
import type { Project, Task } from "@/lib/tasks";
import type { TimeEntry } from "@/lib/time";
import { cn } from "@/lib/utils";

import type { EventSeed } from "./event-draft";
import type { HourZoom } from "./hour-zoom";
import { RAIL_WIDTH_PX, TimeRail } from "./time-rail";

/** Blocks drawn shorter than two lines put their time beside the title. */
const TWO_LINES_PX = 36;
/** The height of a block's title line: blocks that start closer than this sit side by side. */
const TITLE_PX = 20;
/** A click on the empty grid starts a new event on this step. */
const CREATE_STEP_MINUTES = 30;
const HOURS = Array.from({ length: 24 }, (_, hour) => hour);
const weekday = new Intl.DateTimeFormat("ja-JP", { weekday: "short" });

/** What the grid hands back to the planner: opening, creating and editing. */
export interface GridActions {
	canEdit: (event: DisplayEvent) => boolean;
	onCreate: (seed: Omit<EventSeed, "calendarId">) => void;
	onEditEntry: (entry: TimeEntry) => void;
	onOpenEvent: (event: DisplayEvent) => void;
	onOpenTask: (task: Task) => void;
}

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
		left: spanCss(item.left, 1),
		top: (item.start / 60) * hourHeight + 1,
		width: spanCss(item.width, -3),
		zIndex: 1 + item.depth,
		// A block drawn over another is outlined so the two stay apart.
		...(item.depth > 0 ? { boxShadow: "0 0 0 1px var(--background)" } : {}),
	};
}

const eventKey = (event: DisplayEvent) =>
	`event:${event.calendarId}:${event.id}`;

function EventBlock({
	day,
	editable,
	event,
	onOpen,
	short,
	style,
	time,
}: {
	day: string;
	editable: boolean;
	event: DisplayEvent;
	onOpen: (event: DisplayEvent) => void;
	short: boolean;
	style: CSSProperties;
	time: string;
}) {
	const { attributes, isDragging, listeners, setNodeRef } = useDraggable({
		data: { event, fromDay: day },
		disabled: !editable,
		// An event over midnight shows in two columns.
		id: `${eventKey(event)}:${day}`,
	});
	const className = cn(
		"@container absolute flex flex-col overflow-hidden rounded-md border-l-[3px] px-1.5 py-0.5 text-left text-foreground text-xs no-underline",
		short && "flex-row items-center gap-1.5 py-0",
		isDragging && "opacity-40"
	);
	const look = {
		...style,
		backgroundColor: `color-mix(in srgb, ${event.color} 18%, var(--card))`,
		borderLeftColor: event.color,
	};
	const content = (
		<>
			<span
				className={cn(
					"w-full truncate font-medium",
					short && "w-auto min-w-0 flex-1"
				)}
			>
				{event.title || "（タイトルなし）"}
			</span>
			<span
				className={cn(
					"w-full truncate text-[11px] text-muted-foreground tabular-nums",
					short && "@[9rem]:inline hidden w-auto shrink-0"
				)}
			>
				{time}
				{event.location ? ` ${event.location}` : ""}
			</span>
		</>
	);
	const interactive =
		"outline-none hover:brightness-110 focus-visible:shadow-[0_0_0_2px_var(--ring)]";
	if (editable) {
		return (
			<button
				{...attributes}
				{...listeners}
				aria-roledescription="ドラッグできる予定"
				className={cn(
					className,
					interactive,
					"cursor-pointer touch-manipulation items-start border-0 border-l-[3px] border-solid"
				)}
				data-slot="calendar-event"
				onClick={() => onOpen(event)}
				ref={setNodeRef}
				style={look}
				type="button"
			>
				{content}
			</button>
		);
	}
	if (!event.htmlLink) {
		return (
			<div className={className} data-slot="calendar-event" style={look}>
				{content}
			</div>
		);
	}
	return (
		<a
			className={cn(className, interactive)}
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
			className="pointer-events-none absolute inset-x-0 z-[20]"
			data-slot="now-line"
			style={{ top: (minutes / 60) * hourHeight }}
		>
			<div className="h-0.5 bg-[image:var(--prism)] shadow-[var(--glow)]" />
			<span className="absolute -top-[3px] -left-1 size-2 rounded-full bg-primary-text shadow-[0_0_8px_var(--primary-text)]" />
		</div>
	);
}

function DayColumn({
	actions,
	day,
	entries,
	events,
	flipRail,
	hourHeight,
	now,
	nowMs,
	preview,
	projects,
	tasks,
}: {
	actions: GridActions;
	day: Date;
	entries: TimeEntry[];
	events: DisplayEvent[];
	flipRail: boolean;
	hourHeight: number;
	now: number | null;
	nowMs: number;
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
	const stackMinutes = Math.ceil((TITLE_PX / hourHeight) * 60);
	const placed = new Map(
		layoutDay([...timedEvents, ...timedTasks], stackMinutes).map((item) => [
			item.key,
			item,
		])
	);
	// A click on the empty grid starts an event at that half hour.
	const create = (event: MouseEvent<HTMLButtonElement>) => {
		const offset =
			event.clientY - event.currentTarget.getBoundingClientRect().top;
		const minutes =
			Math.floor(((offset / hourHeight) * 60) / CREATE_STEP_MINUTES) *
			CREATE_STEP_MINUTES;
		actions.onCreate({
			allDay: false,
			day: key,
			minutes: Math.min(
				Math.max(minutes, 0),
				DAY_MINUTES - CREATE_STEP_MINUTES
			),
		});
	};
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
			<div
				className="absolute inset-y-0 right-0"
				data-slot="day-items"
				style={{ left: RAIL_WIDTH_PX }}
			>
				{/* Under the blocks: what a click on an empty spot lands on. */}
				<button
					aria-label={`${formatDayLabel(day)}に予定を追加`}
					className="absolute inset-0 cursor-cell border-0 bg-transparent p-0 outline-none"
					data-slot="add-event"
					onClick={create}
					tabIndex={-1}
					type="button"
				/>
				{timedEvents.map((item) => {
					const place = placed.get(item.key);
					return place ? (
						<EventBlock
							day={key}
							editable={actions.canEdit(item.event)}
							event={item.event}
							key={item.key}
							onOpen={actions.onOpenEvent}
							short={((item.end - item.start) / 60) * hourHeight < TWO_LINES_PX}
							style={blockStyle(place, hourHeight)}
							time={formatEventTime(item.event, day)}
						/>
					) : null;
				})}
				{timedTasks.map((item) => {
					const place = placed.get(item.key);
					return place ? (
						<DraggableTask
							className="absolute"
							key={item.key}
							onOpen={actions.onOpenTask}
							projects={projects}
							short={((item.end - item.start) / 60) * hourHeight < TWO_LINES_PX}
							style={blockStyle(place, hourHeight)}
							task={item.task}
							variant="block"
						/>
					) : null;
				})}
			</div>
			<TimeRail
				day={day}
				entries={entries}
				flip={flipRail}
				hourHeight={hourHeight}
				now={nowMs}
				onEditEntry={actions.onEditEntry}
				projects={projects}
			/>
			{preview && preview.day === key ? (
				<div
					aria-hidden
					className="pointer-events-none absolute inset-x-0.5 z-[21] flex items-start rounded-md border-2 border-primary-text border-dashed bg-primary-soft px-1.5 py-0.5 font-mono text-[11px] text-primary-text tabular-nums"
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

function AllDayEvent({
	day,
	editable,
	event,
	onOpen,
}: {
	day: string;
	editable: boolean;
	event: DisplayEvent;
	onOpen: (event: DisplayEvent) => void;
}) {
	const { attributes, isDragging, listeners, setNodeRef } = useDraggable({
		data: { event, fromDay: day },
		disabled: !editable,
		id: `allday:${eventKey(event)}:${day}`,
	});
	const className =
		"block w-full min-w-0 truncate rounded-sm border-0 px-1.5 py-0.5 text-left text-foreground text-xs no-underline";
	const style = {
		backgroundColor: `color-mix(in srgb, ${event.color} 22%, var(--card))`,
	};
	const title = event.title || "（タイトルなし）";
	if (!editable) {
		return event.htmlLink ? (
			<a
				className={className}
				href={event.htmlLink}
				rel="noopener"
				style={style}
				target="_blank"
			>
				{title}
			</a>
		) : (
			<span className={className} style={style}>
				{title}
			</span>
		);
	}
	return (
		<button
			{...attributes}
			{...listeners}
			aria-roledescription="ドラッグできる予定"
			className={cn(
				className,
				"cursor-pointer touch-manipulation outline-none hover:brightness-110 focus-visible:shadow-[0_0_0_2px_var(--ring)]",
				isDragging && "opacity-40"
			)}
			data-slot="calendar-event"
			onClick={() => onOpen(event)}
			ref={setNodeRef}
			style={style}
			type="button"
		>
			{title}
		</button>
	);
}

function AllDayCell({
	actions,
	day,
	events,
	projects,
	tasks,
}: {
	actions: GridActions;
	day: Date;
	events: DisplayEvent[];
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
				"relative flex min-h-8 min-w-0 flex-col gap-0.5 border-border-subtle border-l p-0.5 [&>:not([data-slot=add-event])]:relative",
				isOver && "bg-primary-soft/40"
			)}
			data-slot="all-day"
			ref={setNodeRef}
		>
			<button
				aria-label={`${formatDayLabel(day)}に終日の予定を追加`}
				className="absolute inset-0 cursor-cell border-0 bg-transparent p-0 outline-none"
				data-slot="add-event"
				onClick={() => actions.onCreate({ allDay: true, day: key })}
				tabIndex={-1}
				type="button"
			/>
			{allDay.map((event) => (
				<AllDayEvent
					day={key}
					editable={actions.canEdit(event)}
					event={event}
					key={`${event.calendarId}:${event.id}`}
					onOpen={actions.onOpenEvent}
				/>
			))}
			{untimed.map((task) => (
				<DraggableTask
					key={task.id}
					onOpen={actions.onOpenTask}
					projects={projects}
					task={task}
					variant="chip"
				/>
			))}
		</div>
	);
}

/** The time scale's buttons, in the corner above the hours. */
function ZoomControl({ zoom }: { zoom: HourZoom }) {
	const button = "size-5 rounded-sm [&_svg:not([class*='size-'])]:size-3.5";
	return (
		<div className="flex items-center justify-end gap-0.5 pr-0.5">
			<IconButton
				className={button}
				disabled={!zoom.canZoomOut}
				label="時間の縮尺を縮小"
				onClick={zoom.zoomOut}
				type="button"
			>
				<IconZoomOut aria-hidden />
			</IconButton>
			<IconButton
				className={button}
				disabled={!zoom.canZoomIn}
				label="時間の縮尺を拡大"
				onClick={zoom.zoomIn}
				type="button"
			>
				<IconZoomIn aria-hidden />
			</IconButton>
		</div>
	);
}

/**
 * Hours down the side, one column per day: events from the calendar, tasks
 * placed at a time, and a line at the current time. Tasks dropped on a
 * column take that time; dropped on the 終日 row, they keep only the day.
 */
export function TimeGrid({
	actions,
	days,
	entries,
	events,
	now,
	preview,
	projects,
	showDayHeader,
	tasks,
	today,
	zoom,
}: {
	actions: GridActions;
	days: Date[];
	entries: TimeEntry[];
	events: DisplayEvent[];
	now: number;
	preview: DropPreview | null;
	projects: Project[];
	showDayHeader: boolean;
	tasks: Task[];
	today: Date;
	zoom: HourZoom;
}) {
	const { hourHeight } = zoom;
	const columns = {
		gridTemplateColumns: `2.75rem repeat(${days.length}, minmax(0, 1fr))`,
	};
	const todayKey = dayKey(today);
	const showsToday = days.some((day) => dayKey(day) === todayKey);
	const nowMinutes = Math.floor(minutesIntoDay(now, today));
	const scroller = useRef<HTMLDivElement>(null);
	const firstDay = dayKey(days[0] ?? today);
	const anchorMinutes = showsToday ? Math.max(nowMinutes - 90, 0) : 8 * 60;

	// Open at the current time (or the morning) instead of midnight.
	// biome-ignore lint/correctness/useExhaustiveDependencies: only when the shown days change
	useEffect(() => {
		// The hours start right under the sticky rows, so this puts the anchor there.
		if (scroller.current) {
			scroller.current.scrollTop = (anchorMinutes / 60) * hourHeight;
		}
	}, [firstDay, days.length]);

	return (
		<div
			// The grid scrolls by itself, its day and 終日 rows held at its top,
			// so the page around it stays still.
			className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto overflow-x-hidden overscroll-contain"
			data-slot="time-grid"
			ref={scroller}
			style={{ "--hour": `${hourHeight}px` } as CSSProperties}
		>
			<div
				className="sticky top-0 z-[5] grid border-border border-b bg-background"
				style={columns}
			>
				{showDayHeader ? (
					<>
						<div className="self-center">
							<ZoomControl zoom={zoom} />
						</div>
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
				<div className="flex flex-col items-end gap-0.5 self-start pt-1">
					{showDayHeader ? null : <ZoomControl zoom={zoom} />}
					<span className="pt-0.5 pr-1.5 text-[11px] text-muted-foreground">
						終日
					</span>
				</div>
				{days.map((day) => (
					<AllDayCell
						actions={actions}
						day={day}
						events={events}
						key={dayKey(day)}
						projects={projects}
						tasks={tasks}
					/>
				))}
			</div>
			{/* Its own stack, so the rail and the now line stay under the sticky rows. */}
			<div
				className="relative isolate grid"
				data-slot="time-grid-hours"
				ref={zoom.bodyRef}
				style={columns}
			>
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
				{days.map((day, index) => (
					<DayColumn
						actions={actions}
						day={day}
						entries={entries}
						events={events}
						flipRail={days.length > 2 && index >= days.length - 2}
						hourHeight={hourHeight}
						key={dayKey(day)}
						now={dayKey(day) === todayKey ? nowMinutes : null}
						nowMs={now}
						preview={preview}
						projects={projects}
						tasks={tasks}
					/>
				))}
			</div>
		</div>
	);
}
