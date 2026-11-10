import type { Recurrence, Task, TaskInput } from "@/lib/tasks";

export type RepeatBasis = "none" | Recurrence["basis"];

/** Form state for the task editor; every field is a plain input value. */
export interface TaskDraft {
	dayOfMonth: string;
	deadline: string;
	estimate: string;
	interval: string;
	labelIds: string[];
	note: string;
	priority: number;
	projectId: string;
	repeat: RepeatBasis;
	scheduledDate: string;
	scheduledTime: string;
	startDate: string;
	title: string;
	unit: Recurrence["unit"];
	weekdays: number[];
}

export interface DraftDefaults {
	projectId?: string | null;
	scheduledDate?: string | null;
}

export function draftFromTask(
	task: Task | null | undefined,
	defaults: DraftDefaults = {}
): TaskDraft {
	const rule = task?.recurrence;
	return {
		dayOfMonth: rule?.dayOfMonth ? String(rule.dayOfMonth) : "",
		deadline: task?.deadline ?? "",
		estimate: task?.estimateMinutes ? String(task.estimateMinutes) : "",
		interval: String(rule?.interval ?? 1),
		labelIds: task?.labels.map((label) => label.id) ?? [],
		note: task?.note ?? "",
		priority: task?.priority ?? 4,
		projectId: (task ? task.projectId : defaults.projectId) ?? "",
		repeat: rule?.basis ?? "none",
		scheduledDate: (task ? task.scheduledDate : defaults.scheduledDate) ?? "",
		scheduledTime: task?.scheduledTime ?? "",
		startDate: task?.startDate ?? "",
		title: task?.title ?? "",
		unit: rule?.unit ?? "week",
		weekdays: rule?.weekdays ?? [],
	};
}

function positiveInt(value: string, max: number): number | null {
	const parsed = Number.parseInt(value, 10);
	return Number.isFinite(parsed) && parsed >= 1 ? Math.min(parsed, max) : null;
}

export function draftRecurrence(draft: TaskDraft): Recurrence | null {
	if (draft.repeat === "none") {
		return null;
	}
	const rule: Recurrence = {
		basis: draft.repeat,
		interval: positiveInt(draft.interval, 365) ?? 1,
		unit: draft.unit,
	};
	if (
		draft.repeat === "schedule" &&
		draft.unit === "week" &&
		draft.weekdays.length > 0
	) {
		rule.weekdays = [...draft.weekdays].sort((a, b) => a - b);
	}
	if (draft.repeat === "schedule" && draft.unit === "month") {
		const day = positiveInt(draft.dayOfMonth, 31);
		if (day) {
			rule.dayOfMonth = day;
		}
	}
	return rule;
}

/** Turns the form into the API input; empty fields become null. */
export function draftToInput(draft: TaskDraft): TaskInput {
	return {
		deadline: draft.deadline || null,
		estimateMinutes: positiveInt(draft.estimate, 10_000),
		labelIds: draft.labelIds,
		note: draft.note,
		priority: draft.priority,
		projectId: draft.projectId || null,
		recurrence: draftRecurrence(draft),
		scheduledDate: draft.scheduledDate || null,
		scheduledTime: (draft.scheduledDate && draft.scheduledTime) || null,
		startDate: draft.startDate || null,
		title: draft.title.trim(),
	};
}

/** A problem that blocks saving, or null when the draft is fine. */
export function draftError(draft: TaskDraft): string | null {
	if (!draft.title.trim()) {
		return "タイトルを入力してください";
	}
	const due = draft.scheduledDate || draft.deadline;
	if (draft.startDate && due && draft.startDate > due) {
		return "着手日は予定日や締め切りより前にしてください";
	}
	if (
		draft.scheduledDate &&
		draft.deadline &&
		draft.scheduledDate > draft.deadline
	) {
		return "予定日は締め切りより前にしてください";
	}
	return null;
}
