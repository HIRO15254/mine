import type { RouterInputs, RouterOutputs } from "@mine/api/routers/index";
import type { Recurrence } from "@mine/api/tasks/recurrence";

export type { Recurrence } from "@mine/api/tasks/recurrence";

import { addDays, dayKey, formatDayLabel, parseDayKey } from "./calendar-time";

type Outputs = RouterOutputs;
export type TaskInput = RouterInputs["task"]["create"];
export type Task = Outputs["task"]["list"][number];
export type Project = Outputs["project"]["list"][number];
export type Label = Outputs["label"]["list"][number];
export type ProjectColor = Project["color"];

export const PROJECT_COLORS: ProjectColor[] = [
	"chart-1",
	"chart-2",
	"chart-3",
	"chart-4",
	"chart-5",
];

/** Literal classes so Tailwind keeps them. */
export const PROJECT_COLOR_CLASS: Record<ProjectColor, string> = {
	"chart-1": "bg-chart-1",
	"chart-2": "bg-chart-2",
	"chart-3": "bg-chart-3",
	"chart-4": "bg-chart-4",
	"chart-5": "bg-chart-5",
};

export const PROJECT_COLOR_LABEL: Record<ProjectColor, string> = {
	"chart-1": "青",
	"chart-2": "緑",
	"chart-3": "橙",
	"chart-4": "赤",
	"chart-5": "灰",
};

export const PRIORITY_RING: Record<number, string> = {
	1: "border-destructive text-destructive",
	2: "border-warning text-warning",
	3: "border-primary text-primary",
	4: "border-muted-foreground text-muted-foreground",
};

export function todayKey(now: Date = new Date()): string {
	return dayKey(now);
}

export type DueTone = "overdue" | "today" | "soon" | "later";

export function dueTone(day: string, today: string): DueTone {
	if (day < today) {
		return "overdue";
	}
	if (day === today) {
		return "today";
	}
	const tomorrow = parseDayKey(today);
	return tomorrow && day <= dayKey(addDays(tomorrow, 2)) ? "soon" : "later";
}

/** 今日 / 明日 / 昨日 / 11月7日(土) / 2027年1月4日(月) */
export function formatDay(day: string, today: string): string {
	const date = parseDayKey(day);
	const base = parseDayKey(today);
	if (!(date && base)) {
		return day;
	}
	const offset = Math.round((date.getTime() - base.getTime()) / 86_400_000);
	if (offset === 0) {
		return "今日";
	}
	if (offset === 1) {
		return "明日";
	}
	if (offset === -1) {
		return "昨日";
	}
	const label = formatDayLabel(date);
	return date.getFullYear() === base.getFullYear()
		? label
		: `${date.getFullYear()}年${label}`;
}

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];
const UNIT_LABEL = { day: "日", week: "週間", month: "か月" } as const;

export function formatRecurrence(rule: Recurrence): string {
	if (rule.basis === "completion") {
		return `完了から${rule.interval}${UNIT_LABEL[rule.unit]}後`;
	}
	if (rule.unit === "day") {
		return rule.interval === 1 ? "毎日" : `${rule.interval}日ごと`;
	}
	if (rule.unit === "week") {
		const prefix = rule.interval === 1 ? "毎週" : `${rule.interval}週ごと`;
		const days = [...(rule.weekdays ?? [])]
			.sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7))
			.map((day) => WEEKDAYS[day])
			.join("・");
		return days ? `${prefix} ${days}` : prefix;
	}
	const prefix = rule.interval === 1 ? "毎月" : `${rule.interval}か月ごと`;
	return rule.dayOfMonth ? `${prefix}${rule.dayOfMonth}日` : prefix;
}

export interface QuickAddResult {
	labelIds: string[];
	priority?: number;
	projectId?: string;
	scheduledDate?: string;
	title: string;
}

const PRIORITY_TOKEN = /^[pP]([1-4])$/;
const DATE_WORDS: Record<string, number> = { 今日: 0, 明日: 1, 明後日: 2 };

const WHITESPACE = /\s+/;

interface QuickAddContext {
	labels: Label[];
	projects: Project[];
	today: string;
}

const lower = (value: string) => value.toLowerCase();

/** Applies one token to the result; false when it is plain title text. */
function applyToken(
	token: string,
	result: QuickAddResult,
	context: QuickAddContext
): boolean {
	const priority = PRIORITY_TOKEN.exec(token);
	if (priority) {
		result.priority = Number(priority[1]);
		return true;
	}
	const base = token in DATE_WORDS ? parseDayKey(context.today) : null;
	if (base) {
		result.scheduledDate = dayKey(addDays(base, DATE_WORDS[token] ?? 0));
		return true;
	}
	if (token.length < 2) {
		return false;
	}
	if (token.startsWith("#")) {
		const name = lower(token.slice(1));
		const match = context.projects.find((p) => lower(p.name) === name);
		if (match) {
			result.projectId = match.id;
		}
		return Boolean(match);
	}
	if (token.startsWith("@")) {
		const names = [lower(token), lower(token.slice(1))];
		const match = context.labels.find((l) => names.includes(lower(l.name)));
		if (match && !result.labelIds.includes(match.id)) {
			result.labelIds.push(match.id);
		}
		return Boolean(match);
	}
	return false;
}

/**
 * Reads Todoist-style tokens out of a one-line entry:
 * "p1", "#プロジェクト", "@ラベル" (or the label's own "@name"), "今日/明日/明後日".
 * Unknown #/@ tokens stay in the title so nothing typed is lost.
 */
export function parseQuickAdd(
	text: string,
	context: QuickAddContext
): QuickAddResult {
	const result: QuickAddResult = { labelIds: [], title: "" };
	const words = text
		.split(WHITESPACE)
		.filter((token) => token && !applyToken(token, result, context));
	result.title = words.join(" ");
	return result;
}

/** Projects in tree order with their depth, children after their parent. */
export function flattenProjects(
	projects: Project[]
): Array<Project & { depth: number }> {
	const byParent = new Map<string | null, Project[]>();
	const ids = new Set(projects.map((p) => p.id));
	for (const item of projects) {
		const parent =
			item.parentId && ids.has(item.parentId) ? item.parentId : null;
		byParent.set(parent, [...(byParent.get(parent) ?? []), item]);
	}
	const result: Array<Project & { depth: number }> = [];
	const visit = (parent: string | null, depth: number) => {
		for (const item of byParent.get(parent) ?? []) {
			result.push({ ...item, depth });
			visit(item.id, depth + 1);
		}
	};
	visit(null, 0);
	return result;
}

/** "大学 / 研究" */
export function projectPath(projects: Project[], id: string | null): string {
	const byId = new Map(projects.map((p) => [p.id, p]));
	const names: string[] = [];
	let current = id ? byId.get(id) : undefined;
	for (let depth = 0; current && depth < 10; depth += 1) {
		names.unshift(current.name);
		current = current.parentId ? byId.get(current.parentId) : undefined;
	}
	return names.join(" / ");
}

export const TASK_VIEW_OPTIONS = [
	{ label: "今日", value: "today" },
	{ label: "近日", value: "upcoming" },
	{ label: "インボックス", value: "inbox" },
	{ label: "すべて", value: "open" },
] as const;
export type TaskView = (typeof TASK_VIEW_OPTIONS)[number]["value"];

export interface TaskGroup {
	key: string;
	tasks: Task[];
	/** Empty when the list needs no heading. */
	title: string;
}

function isOverdue(task: Task, today: string): boolean {
	return (
		(task.scheduledDate !== null && task.scheduledDate < today) ||
		(task.deadline !== null && task.deadline < today)
	);
}

/** The first future date the task is due, for the upcoming view. */
function upcomingDay(task: Task, today: string): string | null {
	const days = [task.scheduledDate, task.deadline].filter(
		(day): day is string => day !== null && day > today
	);
	return days.sort()[0] ?? null;
}

function groupBy(
	tasks: Task[],
	keyOf: (task: Task) => string
): Map<string, Task[]> {
	const groups = new Map<string, Task[]>();
	for (const task of tasks) {
		const key = keyOf(task);
		groups.set(key, [...(groups.get(key) ?? []), task]);
	}
	return groups;
}

/**
 * Splits a view's tasks into headed groups. Tasks keep the server's order
 * inside each group.
 */
export function groupTasks(
	tasks: Task[],
	view: TaskView,
	context: { projects: Project[]; today: string }
): TaskGroup[] {
	const { projects, today } = context;
	if (view === "today") {
		const overdue = tasks.filter((task) => isOverdue(task, today));
		const rest = tasks.filter((task) => !isOverdue(task, today));
		return [
			{ key: "overdue", tasks: overdue, title: "期限切れ" },
			{ key: "today", tasks: rest, title: overdue.length ? "今日" : "" },
		].filter((group) => group.tasks.length > 0);
	}
	if (view === "upcoming") {
		const groups = groupBy(tasks, (task) => upcomingDay(task, today) ?? "");
		return [...groups.entries()]
			.sort(([a], [b]) => a.localeCompare(b))
			.map(([day, items]) => ({
				key: day,
				tasks: items,
				title: day ? formatDay(day, today) : "日付なし",
			}));
	}
	if (view === "open") {
		const groups = groupBy(tasks, (task) => task.projectId ?? "");
		const order = ["", ...flattenProjects(projects).map((p) => p.id)];
		const known = new Set(order);
		const unknown = [...groups.keys()].filter((key) => !known.has(key));
		return [...order, ...unknown]
			.filter((key) => groups.has(key))
			.map((key) => ({
				key: key || "inbox",
				tasks: groups.get(key) ?? [],
				title: key ? projectPath(projects, key) || "不明" : "インボックス",
			}));
	}
	return tasks.length ? [{ key: view, tasks, title: "" }] : [];
}
