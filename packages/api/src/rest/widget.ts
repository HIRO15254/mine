import type { ProjectColor } from "@mine/db/schema/tasks";

import { formatDuration } from "../format";
import { projectPath } from "../projects/tree";
import type { Caller } from "../routers/index";
import { addDays } from "../tasks/dates";
import { localDay } from "../time/summary";
import { startOfDayIn } from "../time/zone";

/**
 * What the home-screen widget page shows: the timer, what is left of today's
 * calendar and the tasks on Today, already put in words for one moment. The
 * page itself is drawn by the Worker; this reads through the procedures so
 * the same rules apply as everywhere else.
 */

/** Tasks beyond this many are counted, not listed. */
export const WIDGET_TASK_LIMIT = 8;

export interface WidgetTimer {
	description: string | null;
	/** "1:05" */
	elapsed: string;
	project: string | null;
	projectColor: ProjectColor | null;
	/** "09:30" on the wall clock. */
	startedAt: string;
}

export interface WidgetEvent {
	allDay: boolean;
	color: string | null;
	/** Under way at the snapshot's moment. */
	current: boolean;
	/** "10:30", or null for an all-day event. */
	end: string | null;
	start: string | null;
	title: string;
}

export interface WidgetTask {
	/** Its scheduled day or deadline has passed. */
	overdue: boolean;
	priority: number;
	project: string | null;
	projectColor: ProjectColor | null;
	/** "14:00" when the task is planned for a time today. */
	time: string | null;
	title: string;
}

export interface WidgetSnapshot {
	/** Null when Google Calendar could not be read. */
	events: WidgetEvent[] | null;
	/** Today's tasks left out of `tasks`. */
	moreTasks: number;
	/** "14:05" on the wall clock. */
	now: string;
	tasks: WidgetTask[];
	timer: WidgetTimer | null;
	/** YYYY-MM-DD */
	today: string;
}

function clockIn(timeZone: string) {
	const format = new Intl.DateTimeFormat("en-GB", {
		hour: "2-digit",
		hourCycle: "h23",
		minute: "2-digit",
		timeZone,
	});
	return (ms: number) => format.format(new Date(ms));
}

async function todaysEvents(
	caller: Caller,
	today: string,
	now: number,
	timeZone: string
): Promise<WidgetEvent[] | null> {
	const from = startOfDayIn(today, timeZone);
	const to = startOfDayIn(addDays(today, 1), timeZone);
	let result: Awaited<ReturnType<Caller["calendar"]["events"]>>;
	try {
		result = await caller.calendar.events({
			timeMax: new Date(to).toISOString(),
			timeMin: new Date(from).toISOString(),
		});
	} catch {
		return null;
	}
	const clock = clockIn(timeZone);
	const allDay = result.events
		.filter(
			(event) => event.allDay && event.start <= today && today < event.end
		)
		.map(
			(event): WidgetEvent => ({
				allDay: true,
				color: event.color ?? null,
				current: true,
				end: null,
				start: null,
				title: event.title,
			})
		);
	const timed = result.events
		.filter((event) => !event.allDay)
		.map((event) => ({
			end: Date.parse(event.end),
			event,
			start: Date.parse(event.start),
		}))
		// What has ended is left out; the widget is for the rest of the day.
		.filter((item) => item.end > now && item.start < to)
		.sort((a, b) => a.start - b.start || a.end - b.end)
		.map(
			({ end, event, start }): WidgetEvent => ({
				allDay: false,
				color: event.color ?? null,
				current: start <= now,
				end: clock(end),
				// An event that began yesterday shows from midnight.
				start: clock(Math.max(start, from)),
				title: event.title,
			})
		);
	return [...allDay, ...timed];
}

export async function widgetSnapshot(
	caller: Caller,
	now: number,
	timeZone: string
): Promise<WidgetSnapshot> {
	const today = localDay(now, timeZone);
	const [entry, projects, tasks, events] = await Promise.all([
		caller.time.current(),
		caller.project.list(),
		caller.task.list({ today, view: "today" }),
		todaysEvents(caller, today, now, timeZone),
	]);
	const colorOf = (id: string | null) =>
		projects.find((item) => item.id === id)?.color ?? null;
	const clock = clockIn(timeZone);
	return {
		events,
		moreTasks: Math.max(0, tasks.length - WIDGET_TASK_LIMIT),
		now: clock(now),
		tasks: tasks.slice(0, WIDGET_TASK_LIMIT).map((task) => ({
			overdue:
				(task.deadline !== null && task.deadline < today) ||
				(task.scheduledDate !== null && task.scheduledDate < today),
			priority: task.priority,
			project: projectPath(projects, task.projectId),
			projectColor: colorOf(task.projectId),
			time:
				task.scheduledDate === today && task.scheduledTime
					? task.scheduledTime
					: null,
			title: task.title,
		})),
		timer: entry
			? {
					description: entry.description || null,
					elapsed: formatDuration(now - entry.startedAt),
					project: projectPath(projects, entry.projectId),
					projectColor: colorOf(entry.projectId),
					startedAt: clock(entry.startedAt),
				}
			: null,
		today,
	};
}
