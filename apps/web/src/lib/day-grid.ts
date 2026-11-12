/**
 * Geometry for the calendar's time grid: where events and timed tasks sit in
 * a day, side by side or stacked when they overlap, and which time a drop
 * lands on.
 * Minutes count from the local midnight of the day.
 */
import { addDays, type DisplayEvent, startOfDay } from "./calendar-time";

export const DAY_MINUTES = 24 * 60;
export const SNAP_MINUTES = 15;
/** How long a task without an estimate takes on the grid. */
export const DEFAULT_TASK_MINUTES = 30;
/** The shortest block drawn, so a 5-minute event stays readable. */
const MIN_BLOCK_MINUTES = 20;

const TIME = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function parseTime(value: string | null | undefined): number | null {
	const match = value ? TIME.exec(value) : null;
	return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

/** 540 → "9:00", for the grid's hour labels. */
export function formatClockLabel(minutes: number): string {
	return `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, "0")}`;
}

/** 540 → "09:00": minutes of the day as the `HH:MM` a task's time is stored in. */
export function formatTime(minutes: number): string {
	return formatClockLabel(minutes).padStart(5, "0");
}

export function minutesIntoDay(ms: number, day: Date): number {
	return (ms - startOfDay(day).getTime()) / 60_000;
}

export interface GridItem {
	end: number;
	key: string;
	start: number;
}

/** A horizontal length: a share of the day column plus pixels. */
export interface Span {
	pct: number;
	px: number;
}

export interface PlacedItem extends GridItem {
	/** How many blocks it is drawn on top of; later blocks sit higher. */
	depth: number;
	left: Span;
	width: Span;
}

/** How far a block drawn on top of another moves in, so the one below shows. */
export const STACK_INDENT_PX = 12;

interface Node {
	end: number;
	group: Group;
	item: GridItem;
}

interface Group {
	members: Node[];
	parent: Node | null;
}

const depthOf = (group: Group): number =>
	group.parent ? depthOf(group.parent.group) + 1 : 0;

/** The block drawn last among those still running: the one on top. */
function topmost(nodes: Node[]): Node | undefined {
	let top: Node | undefined;
	for (const node of nodes) {
		if (
			!top ||
			depthOf(node.group) > depthOf(top.group) ||
			(depthOf(node.group) === depthOf(top.group) &&
				node.item.start >= top.item.start)
		) {
			top = node;
		}
	}
	return top;
}

/**
 * Where each item sits across its day column.
 *
 * Items that start within `stackMinutes` of each other would cover each
 * other's titles, so they share the width side by side. An item that starts
 * later than that is drawn on top of the one already running, moved in by
 * `STACK_INDENT_PX`, so the title above it stays readable and the new block
 * keeps most of the width.
 */
export function layoutDay(
	items: GridItem[],
	stackMinutes: number
): PlacedItem[] {
	const sorted = [...items].sort(
		(a, b) => a.start - b.start || b.end - a.end || a.key.localeCompare(b.key)
	);
	const nodes: Node[] = [];
	for (const item of sorted) {
		const end = Math.max(item.end, item.start + MIN_BLOCK_MINUTES);
		const running = nodes.filter((node) => node.end > item.start);
		const close = running.filter(
			(node) => item.start - node.item.start < stackMinutes
		);
		const sibling = topmost(close);
		let group: Group;
		if (sibling) {
			group = sibling.group;
		} else {
			group = { members: [], parent: topmost(running) ?? null };
		}
		const node: Node = { end, group, item };
		group.members.push(node);
		nodes.push(node);
	}

	const spans = new Map<Node, { left: Span; width: Span }>();
	const spanOf = (node: Node): { left: Span; width: Span } => {
		const known = spans.get(node);
		if (known) {
			return known;
		}
		const { members, parent } = node.group;
		const region = parent
			? (() => {
					const below = spanOf(parent);
					return {
						left: { pct: below.left.pct, px: below.left.px + STACK_INDENT_PX },
						width: {
							pct: below.width.pct,
							px: below.width.px - STACK_INDENT_PX,
						},
					};
				})()
			: { left: { pct: 0, px: 0 }, width: { pct: 100, px: 0 } };
		const share = members.length;
		const index = members.indexOf(node);
		const width = {
			pct: region.width.pct / share,
			px: region.width.px / share,
		};
		const span = {
			left: {
				pct: region.left.pct + width.pct * index,
				px: region.left.px + width.px * index,
			},
			width,
		};
		spans.set(node, span);
		return span;
	};

	return nodes.map((node) => ({
		...node.item,
		...spanOf(node),
		depth: depthOf(node.group),
	}));
}

/** `calc()` for a span, with `px` more pixels. */
export function spanCss(span: Span, px = 0): string {
	const pixels = Math.round((span.px + px) * 100) / 100;
	const pct = Math.round(span.pct * 1000) / 1000;
	return `calc(${pct}% + ${pixels}px)`;
}

/** Timed events of the day, clipped to it, in minutes. */
export function timedEventsOn(
	events: DisplayEvent[],
	day: Date
): Array<GridItem & { event: DisplayEvent }> {
	const from = startOfDay(day).getTime();
	const to = addDays(day, 1).getTime();
	return events
		.filter((event) => !event.allDay)
		.map((event) => ({
			end: Date.parse(event.end),
			event,
			start: Date.parse(event.start),
		}))
		.filter((item) => item.start < to && item.end > from)
		.map((item) => ({
			end: Math.min(item.end, to) / 60_000 - from / 60_000,
			event: item.event,
			key: `event:${item.event.calendarId}:${item.event.id}`,
			start: Math.max(item.start, from) / 60_000 - from / 60_000,
		}));
}

/**
 * The start a drop lands on: the dragged block's top edge, `offset` pixels
 * below the top of the day, snapped to 15 minutes and kept inside the day.
 */
export function dropMinutes(
	offset: number,
	hourHeight: number,
	length: number
): number {
	const raw = (offset / hourHeight) * 60;
	const snapped = Math.round(raw / SNAP_MINUTES) * SNAP_MINUTES;
	const latest = DAY_MINUTES - Math.min(length, DAY_MINUTES - SNAP_MINUTES);
	return Math.min(Math.max(snapped, 0), latest);
}

/**
 * Where a dragged task or event was let go: a day's time grid, its 終日 row,
 * a day of the month view, or the tray.
 */
export type DropTarget =
	| { day: string; kind: "allday" }
	| { day: string; kind: "day" }
	| { day: string; kind: "slot" }
	| { kind: "tray" };

/** The two fields that put a task on the calendar. */
export interface Placement {
	scheduledDate: string | null;
	scheduledTime: string | null;
}

/**
 * What a drop changes on the task, or null when it changes nothing.
 *
 * - On a day's grid: that day at `start` minutes (see `dropMinutes`).
 * - On a 終日 row: that day, without a time.
 * - On a day of the month view: that day, keeping the time.
 * - On the tray: the time comes off and the day stays, so the task is still
 *   planned for its day but no longer sits on the grid.
 */
export function placementForDrop(
	task: Placement,
	target: DropTarget,
	start: number | null
): Placement | null {
	let next: Placement;
	if (target.kind === "slot") {
		if (start === null) {
			return null;
		}
		next = { scheduledDate: target.day, scheduledTime: formatTime(start) };
	} else if (target.kind === "allday") {
		next = { scheduledDate: target.day, scheduledTime: null };
	} else if (target.kind === "day") {
		next = { scheduledDate: target.day, scheduledTime: task.scheduledTime };
	} else {
		next = { scheduledDate: task.scheduledDate, scheduledTime: null };
	}
	return next.scheduledDate === task.scheduledDate &&
		next.scheduledTime === task.scheduledTime
		? null
		: next;
}
