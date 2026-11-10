/**
 * Geometry for the calendar's time grid: where events and timed tasks sit in
 * a day, side by side when they overlap, and which time a drop lands on.
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

/** 540 → "09:00" */
export function formatTime(minutes: number): string {
	const hours = Math.floor(minutes / 60);
	return `${String(hours).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

/** 540 → "9:00", for labels. */
export function formatClockLabel(minutes: number): string {
	return `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, "0")}`;
}

export function minutesIntoDay(ms: number, day: Date): number {
	return (ms - startOfDay(day).getTime()) / 60_000;
}

export interface GridItem {
	end: number;
	key: string;
	start: number;
}

export interface PlacedItem extends GridItem {
	/** 0-based column within its group of overlapping items. */
	column: number;
	/** How many columns its group needs. */
	columns: number;
}

/**
 * Side-by-side columns for overlapping items: each item takes the first
 * column free at its start, and every item in a cluster of overlaps shares
 * the cluster's column count.
 */
export function layoutDay(items: GridItem[]): PlacedItem[] {
	const sorted = [...items].sort(
		(a, b) => a.start - b.start || b.end - a.end || a.key.localeCompare(b.key)
	);
	const placed: PlacedItem[] = [];
	let cluster: PlacedItem[] = [];
	let columnEnds: number[] = [];
	let clusterEnd = Number.NEGATIVE_INFINITY;
	const closeCluster = () => {
		for (const item of cluster) {
			item.columns = columnEnds.length;
		}
		cluster = [];
		columnEnds = [];
	};
	for (const item of sorted) {
		const end = Math.max(item.end, item.start + MIN_BLOCK_MINUTES);
		if (item.start >= clusterEnd) {
			closeCluster();
		}
		let column = columnEnds.findIndex((columnEnd) => columnEnd <= item.start);
		if (column < 0) {
			column = columnEnds.length;
			columnEnds.push(end);
		} else {
			columnEnds[column] = end;
		}
		const entry = { ...item, column, columns: 1 };
		cluster.push(entry);
		placed.push(entry);
		clusterEnd = Math.max(clusterEnd, end);
	}
	closeCluster();
	return placed;
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
