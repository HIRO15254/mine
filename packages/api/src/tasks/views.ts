import { addDays } from "./dates";

export const TASK_VIEWS = ["today", "inbox", "upcoming", "open"] as const;
export type TaskView = (typeof TASK_VIEWS)[number];

/** Label that marks a task as a next action, shown on Today regardless of dates. */
export const NEXT_LABEL = "next";
export const UPCOMING_DAYS = 14;

export interface ViewTask {
	createdAt: Date;
	deadline: string | null;
	labels: Array<{ name: string }>;
	priority: number;
	projectId: string | null;
	scheduledDate: string | null;
	startDate: string | null;
}

/** Whether the task may be worked on today (最速実行可能日 has arrived). */
export function isAvailable(task: ViewTask, today: string): boolean {
	return task.startDate === null || task.startDate <= today;
}

function isNextAction(task: ViewTask): boolean {
	return task.labels.some((label) => label.name.toLowerCase() === NEXT_LABEL);
}

export function inView(task: ViewTask, view: TaskView, today: string): boolean {
	switch (view) {
		case "today":
			return (
				isAvailable(task, today) &&
				((task.scheduledDate !== null && task.scheduledDate <= today) ||
					(task.deadline !== null && task.deadline <= today) ||
					isNextAction(task))
			);
		case "inbox":
			return task.projectId === null;
		case "upcoming": {
			const last = addDays(today, UPCOMING_DAYS);
			const within = (day: string | null) =>
				day !== null && day > today && day <= last;
			return within(task.scheduledDate) || within(task.deadline);
		}
		default:
			return true;
	}
}

function dueDay(task: ViewTask): string {
	return task.scheduledDate ?? task.deadline ?? "9999-12-31";
}

/** Priority first, then the earliest date, then the older task. */
export function compareTasks(a: ViewTask, b: ViewTask): number {
	return (
		a.priority - b.priority ||
		dueDay(a).localeCompare(dueDay(b)) ||
		a.createdAt.getTime() - b.createdAt.getTime()
	);
}
