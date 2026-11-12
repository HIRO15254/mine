import { useDraggable, useDroppable } from "@dnd-kit/core";
import { IconPlus } from "@tabler/icons-react";
import type { CSSProperties } from "react";

import { Button } from "@/components/ui/button/button";
import {
	type DisplayEvent,
	dayKey,
	eventsOnDay,
	formatClock,
	formatDayLabel,
	formatEventTime,
} from "@/lib/calendar-time";
import { parseTime } from "@/lib/day-grid";
import type { Project, Task } from "@/lib/tasks";
import { cn } from "@/lib/utils";

import { DraggableTask, type GridActions } from "./time-grid";

const WEEKDAYS = ["月", "火", "水", "木", "金", "土", "日"];
/** Items a cell shows before it folds the rest into 他 N 件. */
const DESK_ITEMS = 4;
const MOBILE_ITEMS = 2;

type Item =
	| { event: DisplayEvent; kind: "event" }
	| { kind: "task"; task: Task };

/** What a day shows: all-day events, then timed ones and tasks by time. */
export function itemsOnDay(
	day: Date,
	events: DisplayEvent[],
	tasks: Task[]
): Item[] {
	const key = dayKey(day);
	const dayEvents = eventsOnDay(events, day);
	const timed = [
		...dayEvents
			.filter((event) => !event.allDay)
			.map((event) => ({
				at: new Date(Date.parse(event.start)).getTime(),
				item: { event, kind: "event" } as Item,
			})),
		...tasks
			.filter((task) => task.scheduledDate === key)
			.map((task) => {
				const minutes = parseTime(task.scheduledTime);
				return {
					// Untimed tasks after the timed things of the day.
					at:
						minutes === null
							? Number.POSITIVE_INFINITY
							: minutes * 60_000 + day.getTime(),
					item: { kind: "task", task } as Item,
				};
			}),
	].sort((a, b) => a.at - b.at);
	return [
		...dayEvents
			.filter((event) => event.allDay)
			.map((event): Item => ({ event, kind: "event" })),
		...timed.map((entry) => entry.item),
	];
}

const itemKey = (item: Item) =>
	item.kind === "event"
		? `event:${item.event.calendarId}:${item.event.id}`
		: `task:${item.task.id}`;

function MonthEvent({
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
		id: `month:${day}:${event.calendarId}:${event.id}`,
	});
	const title = event.title || "（タイトルなし）";
	const content = event.allDay ? (
		<span className="min-w-0 flex-1 truncate">{title}</span>
	) : (
		<>
			<span
				aria-hidden
				className="size-1.5 shrink-0 rounded-full bg-[var(--c)]"
			/>
			<span className="shrink-0 font-mono text-[10px] text-muted-foreground tabular-nums">
				{formatClock(Date.parse(event.start))}
			</span>
			<span className="min-w-0 flex-1 truncate">{title}</span>
		</>
	);
	const className = cn(
		"flex w-full min-w-0 items-center gap-1 rounded-sm border-0 px-1 py-px text-left text-[11px] text-foreground leading-4 no-underline outline-none focus-visible:shadow-[0_0_0_2px_var(--ring)]",
		event.allDay
			? "bg-[color-mix(in_srgb,var(--c)_22%,var(--card))]"
			: "hover:layer-accent bg-transparent",
		isDragging && "opacity-40"
	);
	const style = { "--c": event.color } as CSSProperties;
	if (!editable) {
		return event.htmlLink ? (
			<a
				className={className}
				href={event.htmlLink}
				rel="noopener"
				style={style}
				target="_blank"
			>
				{content}
			</a>
		) : (
			<span className={className} style={style}>
				{content}
			</span>
		);
	}
	return (
		<button
			{...attributes}
			{...listeners}
			aria-roledescription="ドラッグできる予定"
			className={cn(className, "cursor-pointer touch-manipulation")}
			data-slot="calendar-event"
			onClick={() => onOpen(event)}
			ref={setNodeRef}
			style={style}
			type="button"
		>
			{content}
		</button>
	);
}

/** A thin line per item, for the phone's small cells. */
function ItemBar({ item, projects }: { item: Item; projects: Project[] }) {
	const color =
		item.kind === "event"
			? item.event.color
			: (() => {
					const project = projects.find((p) => p.id === item.task.projectId);
					return project ? `var(--${project.color})` : "var(--primary-text)";
				})();
	const title =
		item.kind === "event"
			? item.event.title || "（タイトルなし）"
			: item.task.title;
	return (
		<span
			className={cn(
				"block truncate rounded-[3px] px-0.5 text-[9px] text-foreground leading-[13px]",
				item.kind === "task" && "border border-[var(--c)] border-dashed"
			)}
			style={
				{
					"--c": color,
					backgroundColor:
						item.kind === "event"
							? `color-mix(in srgb, ${color} 26%, var(--card))`
							: undefined,
				} as CSSProperties
			}
		>
			{title}
		</span>
	);
}

function DayCell({
	actions,
	compact,
	day,
	events,
	inMonth,
	isToday,
	onPickDay,
	projects,
	selected,
	tasks,
}: {
	actions: GridActions;
	compact: boolean;
	day: Date;
	events: DisplayEvent[];
	inMonth: boolean;
	isToday: boolean;
	onPickDay: (day: Date) => void;
	projects: Project[];
	selected: boolean;
	tasks: Task[];
}) {
	const key = dayKey(day);
	const { isOver, setNodeRef } = useDroppable({
		data: { day: key, kind: "day" },
		id: `day:${key}`,
	});
	const items = itemsOnDay(day, events, tasks);
	const limit = compact ? MOBILE_ITEMS : DESK_ITEMS;
	// Fold one more so the 他 N 件 line takes the last row.
	const shown = items.length > limit ? items.slice(0, limit - 1) : items;
	const hidden = items.length - shown.length;
	const number = (
		<span
			className={cn(
				"inline-flex size-6 items-center justify-center rounded-full font-semibold text-xs tabular-nums",
				!inMonth && "text-muted-foreground opacity-60",
				isToday &&
					"bg-primary-soft text-primary-text shadow-[var(--glow)] [text-shadow:var(--glow-text)]"
			)}
		>
			{day.getDate()}
		</span>
	);

	if (compact) {
		return (
			<button
				aria-label={formatDayLabel(day)}
				aria-pressed={selected}
				className={cn(
					"flex h-16 min-w-0 cursor-pointer flex-col gap-px overflow-hidden border-0 border-border-subtle border-t bg-transparent p-0.5 text-left",
					selected && "bg-primary-soft/60",
					isOver && "bg-primary-soft"
				)}
				data-month-day={key}
				onClick={() => onPickDay(day)}
				ref={setNodeRef}
				type="button"
			>
				<span className="self-center">{number}</span>
				{shown.map((item) => (
					<ItemBar item={item} key={itemKey(item)} projects={projects} />
				))}
				{hidden > 0 ? (
					<span className="px-0.5 text-[9px] text-muted-foreground leading-[13px]">
						+{hidden}
					</span>
				) : null}
			</button>
		);
	}

	return (
		<div
			className={cn(
				"relative flex min-h-28 min-w-0 flex-col gap-px border-border-subtle border-t border-l p-1 [&>:not([data-slot=add-event])]:relative",
				!inMonth && "bg-muted",
				isOver && "bg-primary-soft/40"
			)}
			data-month-day={key}
			ref={setNodeRef}
		>
			<button
				aria-label={`${formatDayLabel(day)}に予定を追加`}
				className="absolute inset-0 cursor-cell border-0 bg-transparent p-0 outline-none"
				data-slot="add-event"
				onClick={() => actions.onCreate({ allDay: true, day: key })}
				tabIndex={-1}
				type="button"
			/>
			<button
				aria-label={`${formatDayLabel(day)}の週を開く`}
				className="hover:layer-accent mb-0.5 cursor-pointer self-start rounded-full border-0 bg-transparent p-0 outline-none focus-visible:shadow-[0_0_0_2px_var(--ring)]"
				onClick={() => onPickDay(day)}
				type="button"
			>
				{number}
			</button>
			{shown.map((item) =>
				item.kind === "event" ? (
					<MonthEvent
						day={key}
						editable={actions.canEdit(item.event)}
						event={item.event}
						key={itemKey(item)}
						onOpen={actions.onOpenEvent}
					/>
				) : (
					<DraggableTask
						className="py-px text-[11px]"
						key={itemKey(item)}
						onOpen={actions.onOpenTask}
						projects={projects}
						task={item.task}
						variant="chip"
					/>
				)
			)}
			{hidden > 0 ? (
				<button
					className="hover:layer-accent cursor-pointer self-start rounded-sm border-0 bg-transparent px-1 text-[11px] text-muted-foreground hover:text-foreground"
					onClick={() => onPickDay(day)}
					type="button"
				>
					他 {hidden} 件
				</button>
			) : null}
		</div>
	);
}

/**
 * The month as weeks of days. On the desk each day lists its events and
 * tasks, and things can be dragged between days; on the phone the cells are
 * small and a tap picks the day whose list shows below.
 */
export function MonthGrid({
	actions,
	compact,
	days,
	events,
	month,
	onPickDay,
	projects,
	selected,
	tasks,
	today,
}: {
	actions: GridActions;
	compact: boolean;
	days: Date[];
	events: DisplayEvent[];
	month: Date;
	onPickDay: (day: Date) => void;
	projects: Project[];
	selected: string | null;
	tasks: Task[];
	today: Date;
}) {
	const todayKey = dayKey(today);
	return (
		<div
			className={cn(
				"grid grid-cols-7 overflow-hidden",
				!compact && "rounded-lg border-border border-r border-b"
			)}
			data-slot="month-grid"
		>
			{WEEKDAYS.map((name) => (
				<span
					className={cn(
						"py-1 text-center text-muted-foreground text-xs",
						!compact && "border-border-subtle border-l"
					)}
					key={name}
				>
					{name}
				</span>
			))}
			{days.map((day) => (
				<DayCell
					actions={actions}
					compact={compact}
					day={day}
					events={events}
					inMonth={day.getMonth() === month.getMonth()}
					isToday={dayKey(day) === todayKey}
					key={dayKey(day)}
					onPickDay={onPickDay}
					projects={projects}
					selected={dayKey(day) === selected}
					tasks={tasks}
				/>
			))}
		</div>
	);
}

/** The phone's list under the month: the picked day's events and tasks. */
export function DayAgenda({
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
	const items = itemsOnDay(day, events, tasks);
	return (
		<section aria-label={formatDayLabel(day)} className="flex flex-col gap-2">
			<div className="flex items-center gap-2">
				<h2 className="m-0 flex-1 font-semibold text-[length:var(--m-text-body)]">
					{formatDayLabel(day)}
				</h2>
				<Button
					onClick={() => actions.onCreate({ allDay: false, day: dayKey(day) })}
					size="sm"
					type="button"
					variant="outline"
				>
					<IconPlus aria-hidden />
					予定を追加
				</Button>
			</div>
			{items.length === 0 ? (
				<p className="m-0 py-2 text-[length:var(--m-text-secondary)] text-muted-foreground">
					予定とタスクはありません
				</p>
			) : (
				<ul className="m-0 flex list-none flex-col gap-1 p-0">
					{items.map((item) => (
						<li key={itemKey(item)}>
							{item.kind === "event" ? (
								<AgendaEvent
									day={day}
									editable={actions.canEdit(item.event)}
									event={item.event}
									onOpen={actions.onOpenEvent}
								/>
							) : (
								<DraggableTask
									className="w-full py-2 text-[length:var(--m-text-secondary)]"
									onOpen={actions.onOpenTask}
									projects={projects}
									task={item.task}
									variant="chip"
								/>
							)}
						</li>
					))}
				</ul>
			)}
		</section>
	);
}

function AgendaEvent({
	day,
	editable,
	event,
	onOpen,
}: {
	day: Date;
	editable: boolean;
	event: DisplayEvent;
	onOpen: (event: DisplayEvent) => void;
}) {
	const className =
		"flex w-full min-w-0 items-center gap-2 rounded-md border-0 border-l-[3px] border-solid px-2 py-2 text-left text-[length:var(--m-text-secondary)] text-foreground no-underline outline-none focus-visible:shadow-[0_0_0_2px_var(--ring)]";
	const style = {
		backgroundColor: `color-mix(in srgb, ${event.color} 16%, var(--card))`,
		borderLeftColor: event.color,
	};
	const content = (
		<>
			<span className="w-24 shrink-0 font-mono text-muted-foreground text-xs tabular-nums">
				{formatEventTime(event, day)}
			</span>
			<span className="min-w-0 flex-1 truncate">
				{event.title || "（タイトルなし）"}
			</span>
		</>
	);
	if (editable) {
		return (
			<button
				className={cn(className, "cursor-pointer")}
				onClick={() => onOpen(event)}
				style={style}
				type="button"
			>
				{content}
			</button>
		);
	}
	return event.htmlLink ? (
		<a
			className={className}
			href={event.htmlLink}
			rel="noopener"
			style={style}
			target="_blank"
		>
			{content}
		</a>
	) : (
		<div className={className} style={style}>
			{content}
		</div>
	);
}
