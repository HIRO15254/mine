import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { findProject, startTimer, stopTimer, timerStatus } from "../rest/timer";
import type { appRouter } from "../routers/index";
import { addDays, isDayKey } from "../tasks/dates";
import { recurrenceSchema } from "../tasks/recurrence";
import { TASK_VIEWS } from "../tasks/views";
import { localDay } from "../time/summary";
import { startOfDayIn } from "../time/zone";

/**
 * The tools Claude can call over MCP. Each one runs through the tRPC
 * procedures, so validation and ownership rules stay in one place.
 */

export type Caller = ReturnType<typeof appRouter.createCaller>;
type Project = Awaited<ReturnType<Caller["project"]["list"]>>[number];
type Label = Awaited<ReturnType<Caller["label"]["list"]>>[number];
type Task = Awaited<ReturnType<Caller["task"]["list"]>>[number];

export interface ToolEnv {
	caller: Caller;
	now: number;
	timeZone: string;
}

export interface ToolAnnotations {
	destructiveHint?: boolean;
	idempotentHint?: boolean;
	openWorldHint?: boolean;
	readOnlyHint?: boolean;
}

export interface Tool<Input extends z.ZodType = z.ZodType> {
	annotations: ToolAnnotations;
	description: string;
	input: Input;
	name: string;
	run: (input: z.infer<Input>, env: ToolEnv) => Promise<unknown>;
	title: string;
}

/** Keeps each tool's input type while storing them in one list. */
function defineTool<Input extends z.ZodType>(tool: Tool<Input>): Tool {
	return tool as unknown as Tool;
}

const MINUTE = 60_000;
const LABEL_MARK = /^@/;
const MAX_TASKS = 100;
const MAX_ENTRIES = 100;
const MAX_EVENT_DAYS = 31;

const day = z
	.string()
	.refine(isDayKey, { message: "Expected a date as YYYY-MM-DD" });
const priority = z
	.number()
	.int()
	.min(1)
	.max(4)
	.describe("1 is the most urgent (p1), 4 is the default");
const projectRef = z
	.string()
	.trim()
	.min(1)
	.describe('Project name or path such as "大学 / 研究"');

function fail(message: string): never {
	throw new TRPCError({ code: "BAD_REQUEST", message });
}

/** Drops empty fields so results stay short for the model. */
function compact<T extends Record<string, unknown>>(value: T): Partial<T> {
	return Object.fromEntries(
		Object.entries(value).filter(
			([, item]) =>
				item !== null &&
				item !== undefined &&
				item !== "" &&
				!(Array.isArray(item) && item.length === 0)
		)
	) as Partial<T>;
}

function projectPath(projects: Project[], id: string | null): string | null {
	const byId = new Map(projects.map((item) => [item.id, item]));
	const names: string[] = [];
	let current = id ? byId.get(id) : undefined;
	for (let depth = 0; current && depth < 20; depth += 1) {
		names.unshift(current.name);
		current = current.parentId ? byId.get(current.parentId) : undefined;
	}
	return names.length > 0 ? names.join(" / ") : null;
}

function resolveProject(projects: Project[], ref: string): Project {
	const match = findProject(projects, ref);
	if (!match) {
		const known = projects
			.filter((item) => !item.archived)
			.map((item) => projectPath(projects, item.id))
			.join(", ");
		fail(`Unknown project "${ref}". Projects: ${known || "(none)"}`);
	}
	return match;
}

function resolveLabels(labels: Label[], names: string[]): string[] {
	return names.map((name) => {
		const wanted = name.trim().replace(LABEL_MARK, "").toLowerCase();
		const match = labels.find((item) => item.name.toLowerCase() === wanted);
		if (!match) {
			const known = labels.map((item) => item.name).join(", ");
			fail(`Unknown label "${name}". Labels: ${known || "(none)"}`);
		}
		return match.id;
	});
}

function descendants(projects: Project[], rootId: string): Set<string> {
	const ids = new Set([rootId]);
	let grew = true;
	while (grew) {
		grew = false;
		for (const item of projects) {
			if (item.parentId && ids.has(item.parentId) && !ids.has(item.id)) {
				ids.add(item.id);
				grew = true;
			}
		}
	}
	return ids;
}

/** Parents before their children, keeping the app's order among siblings. */
function treeOrder<T extends { id: string; parentId: string | null }>(
	items: T[]
): T[] {
	const ids = new Set(items.map((item) => item.id));
	const children = new Map<string | null, T[]>();
	for (const item of items) {
		const parent =
			item.parentId && ids.has(item.parentId) ? item.parentId : null;
		children.set(parent, [...(children.get(parent) ?? []), item]);
	}
	const ordered: T[] = [];
	const visit = (parent: string | null) => {
		for (const item of children.get(parent) ?? []) {
			ordered.push(item);
			visit(item.id);
		}
	};
	visit(null);
	return ordered;
}

function describeTask(task: Task, projects: Project[]) {
	return compact({
		deadline: task.deadline,
		estimateMinutes: task.estimateMinutes,
		id: task.id,
		labels: task.labels.map((item) => item.name),
		note: task.note,
		priority: task.priority,
		project: projectPath(projects, task.projectId),
		recurrence: task.recurrence,
		scheduledDate: task.scheduledDate,
		startDate: task.startDate,
		title: task.title,
	});
}

const clock = (ms: number) => {
	const minutes = Math.max(0, Math.floor(ms / MINUTE));
	return `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, "0")}`;
};

function localTime(ms: number, timeZone: string): string {
	return new Intl.DateTimeFormat("sv-SE", {
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		month: "2-digit",
		timeZone,
		year: "numeric",
	}).format(new Date(ms));
}

const taskFields = {
	deadline: day.nullish().describe("締め切り: the due date"),
	estimateMinutes: z.number().int().min(1).max(10_000).nullish(),
	labels: z
		.array(z.string())
		.max(20)
		.optional()
		.describe("Label names; replaces the task's labels"),
	note: z.string().max(10_000).optional(),
	priority: priority.optional(),
	recurrence: recurrenceSchema
		.nullish()
		.describe(
			'Repeat rule. basis "schedule" repeats on fixed dates, "completion" counts from the day it is done'
		),
	scheduledDate: day.nullish().describe("予定日: the day planned to do it"),
	startDate: day
		.nullish()
		.describe("最速実行可能日: hidden from Today until this day"),
};

async function taskInput(
	env: ToolEnv,
	input: {
		labels?: string[];
		project?: string | null;
	}
) {
	const [projects, labels] = await Promise.all([
		env.caller.project.list(),
		input.labels ? env.caller.label.list() : Promise.resolve([]),
	]);
	return {
		labelIds: input.labels ? resolveLabels(labels, input.labels) : undefined,
		projectId:
			input.project === undefined
				? undefined
				: input.project && resolveProject(projects, input.project).id,
		projects,
	};
}

const listTasks = defineTool({
	name: "list_tasks",
	title: "タスクを見る",
	description:
		'Lists open tasks. view "today": due, scheduled or next-labelled tasks that can start today; "upcoming": the next 14 days; "inbox": tasks without a project; "open": everything. Optional project (includes subprojects) and a text query.',
	annotations: { readOnlyHint: true },
	input: z.object({
		project: projectRef.optional(),
		query: z.string().trim().min(1).optional(),
		view: z.enum(TASK_VIEWS).default("today"),
	}),
	run: async (input, env) => {
		const today = localDay(env.now, env.timeZone);
		const [tasks, projects] = await Promise.all([
			env.caller.task.list({ today, view: input.view }),
			env.caller.project.list(),
		]);
		const scope = input.project
			? descendants(projects, resolveProject(projects, input.project).id)
			: null;
		const query = input.query?.toLowerCase();
		const matches = tasks.filter(
			(task) =>
				(!scope || (task.projectId !== null && scope.has(task.projectId))) &&
				(!query ||
					task.title.toLowerCase().includes(query) ||
					task.note.toLowerCase().includes(query))
		);
		return {
			count: matches.length,
			tasks: matches
				.slice(0, MAX_TASKS)
				.map((task) => describeTask(task, projects)),
			today,
		};
	},
});

const addTask = defineTool({
	name: "add_task",
	title: "タスクを追加",
	description:
		"Adds a task. Without a project it goes to the inbox. Turn relative dates (明日, 来週の月曜) into YYYY-MM-DD yourself.",
	annotations: {},
	input: z.object({
		...taskFields,
		project: projectRef.optional(),
		title: z.string().trim().min(1).max(500),
	}),
	run: async (input, env) => {
		const { labels, project, ...fields } = input;
		const refs = await taskInput(env, { labels, project });
		const task = await env.caller.task.create({
			...fields,
			labelIds: refs.labelIds,
			projectId: refs.projectId,
		});
		return { added: describeTask(task, refs.projects) };
	},
});

const updateTask = defineTool({
	name: "update_task",
	title: "タスクを変更",
	description:
		"Changes a task found with list_tasks. Only the given fields change; pass null to clear a date, or project null to move it to the inbox.",
	annotations: { idempotentHint: true },
	input: z.object({
		...taskFields,
		id: z.string().min(1),
		project: projectRef.nullish(),
		title: z.string().trim().min(1).max(500).optional(),
	}),
	run: async (input, env) => {
		const { labels, project, ...fields } = input;
		const refs = await taskInput(env, { labels, project });
		const task = await env.caller.task.update({
			...fields,
			labelIds: refs.labelIds,
			projectId: project === null ? null : refs.projectId,
		});
		return { updated: describeTask(task, refs.projects) };
	},
});

const completeTask = defineTool({
	name: "complete_task",
	title: "タスクを完了",
	description:
		"Completes a task. A recurring task moves to its next occurrence instead.",
	annotations: {},
	input: z.object({ id: z.string().min(1) }),
	run: async (input, env) => {
		const result = await env.caller.task.complete({
			id: input.id,
			today: localDay(env.now, env.timeZone),
		});
		const projects = await env.caller.project.list();
		return {
			next: result.recurring ? describeTask(result.task, projects) : undefined,
			text: result.recurring
				? "完了して次の回に進めました"
				: `完了しました: ${result.task.title}`,
		};
	},
});

const deleteTask = defineTool({
	name: "delete_task",
	title: "タスクを削除",
	description:
		"Deletes a task for good. Prefer complete_task for finished work; confirm with the user first.",
	annotations: { destructiveHint: true, idempotentHint: true },
	input: z.object({ id: z.string().min(1) }),
	run: async (input, env) => {
		await env.caller.task.delete({ id: input.id });
		return { deleted: input.id };
	},
});

const listProjects = defineTool({
	name: "list_projects",
	title: "プロジェクトとラベル",
	description:
		"Lists projects (shared by tasks and time tracking) and task labels.",
	annotations: { readOnlyHint: true },
	input: z.object({}),
	run: async (_input, env) => {
		const [projects, labels] = await Promise.all([
			env.caller.project.list(),
			env.caller.label.list(),
		]);
		return {
			labels: labels.map((item) => item.name),
			projects: treeOrder(projects.filter((item) => !item.archived)).map(
				(item) => ({ id: item.id, path: projectPath(projects, item.id) })
			),
		};
	},
});

const getTimer = defineTool({
	name: "get_timer",
	title: "計測中の記録",
	description: "Shows what the timer is tracking now, if anything.",
	annotations: { readOnlyHint: true },
	input: z.object({}),
	run: (_input, env) => timerStatus(env.caller, env.now),
});

const startTimerTool = defineTool({
	name: "start_timer",
	title: "計測を始める",
	description:
		"Starts the timer, stopping any running entry. With taskId the description and project come from the task.",
	annotations: {},
	input: z.object({
		description: z.string().trim().max(500).optional(),
		project: projectRef.optional(),
		taskId: z.string().min(1).optional(),
	}),
	run: (input, env) => startTimer(env.caller, input, env.now),
});

const stopTimerTool = defineTool({
	name: "stop_timer",
	title: "計測を止める",
	description: "Stops the running timer.",
	annotations: { idempotentHint: true },
	input: z.object({}),
	run: (_input, env) => stopTimer(env.caller),
});

const offsetDateTime = z.iso
	.datetime({ offset: true })
	.describe("ISO 8601 with offset, e.g. 2026-11-06T10:00:00+09:00");

const addTimeEntry = defineTool({
	name: "add_time_entry",
	title: "記録を追加",
	description:
		"Records time already spent, e.g. 「昨日 10 時から 2 時間、論文を読んだ」.",
	annotations: {},
	input: z.object({
		billable: z.boolean().optional(),
		description: z.string().trim().max(500).optional(),
		end: offsetDateTime,
		project: projectRef.optional(),
		start: offsetDateTime,
		taskId: z.string().min(1).optional(),
	}),
	run: async (input, env) => {
		const projects = await env.caller.project.list();
		const entry = await env.caller.time.create({
			billable: input.billable,
			description: input.description,
			endedAt: Date.parse(input.end),
			projectId: input.project
				? resolveProject(projects, input.project).id
				: undefined,
			startedAt: Date.parse(input.start),
			taskId: input.taskId,
		});
		return {
			added: compact({
				description: entry.description,
				duration: clock((entry.endedAt ?? entry.startedAt) - entry.startedAt),
				end: entry.endedAt && localTime(entry.endedAt, env.timeZone),
				project: projectPath(projects, entry.projectId),
				start: localTime(entry.startedAt, env.timeZone),
			}),
		};
	},
});

function dayRange(from: string, to: string | undefined, timeZone: string) {
	const last = to ?? from;
	if (last < from) {
		fail("to must not be before from");
	}
	return {
		from: startOfDayIn(from, timeZone),
		to: startOfDayIn(addDays(last, 1), timeZone),
	};
}

const timeReport = defineTool({
	name: "time_report",
	title: "記録の集計",
	description:
		"Totals tracked time per project and per day for a date range (inclusive), with billable amounts in yen. Lists entries when the range is 62 days or less.",
	annotations: { readOnlyHint: true },
	input: z.object({ from: day, to: day.optional() }),
	run: async (input, env) => {
		const range = dayRange(input.from, input.to, env.timeZone);
		const [summary, projects] = await Promise.all([
			env.caller.time.summary({ ...range, timeZone: env.timeZone }),
			env.caller.project.list(),
		]);
		const entries =
			range.to - range.from <= 62 * 24 * 60 * MINUTE
				? await env.caller.time.list(range)
				: [];
		return {
			amountYen: summary.amount,
			days: summary.days.map((item) => ({
				day: item.day,
				total: clock(item.durationMs),
			})),
			entries: entries.slice(0, MAX_ENTRIES).map((entry) =>
				compact({
					billable: entry.billable,
					description: entry.description,
					duration: clock((entry.endedAt ?? env.now) - entry.startedAt),
					end: entry.endedAt
						? localTime(entry.endedAt, env.timeZone)
						: "計測中",
					project: projectPath(projects, entry.projectId),
					start: localTime(entry.startedAt, env.timeZone),
				})
			),
			projects: summary.projects.map((item) =>
				compact({
					amountYen: item.amount,
					project: projectPath(projects, item.projectId) ?? "プロジェクトなし",
					total: clock(item.durationMs),
				})
			),
			total: clock(summary.durationMs),
		};
	},
});

const listEvents = defineTool({
	name: "list_events",
	title: "予定を見る",
	description:
		"Lists Google Calendar events from the calendars shown in Mine, for a date range (inclusive, up to 31 days). Read-only.",
	annotations: { openWorldHint: true, readOnlyHint: true },
	input: z.object({ from: day, to: day.optional() }),
	run: async (input, env) => {
		const range = dayRange(input.from, input.to, env.timeZone);
		if (range.to - range.from > MAX_EVENT_DAYS * 24 * 60 * MINUTE) {
			fail(`The range must be ${MAX_EVENT_DAYS} days or less`);
		}
		const result = await env.caller.calendar.events({
			timeMax: new Date(range.to).toISOString(),
			timeMin: new Date(range.from).toISOString(),
		});
		const names = new Map(result.calendars.map((item) => [item.id, item.name]));
		return {
			events: result.events
				.sort((a, b) => a.start.localeCompare(b.start))
				.map((event) =>
					compact({
						allDay: event.allDay || undefined,
						calendar: names.get(event.calendarId),
						end: event.allDay
							? event.end
							: localTime(Date.parse(event.end), env.timeZone),
						location: event.location,
						start: event.allDay
							? event.start
							: localTime(Date.parse(event.start), env.timeZone),
						title: event.title,
					})
				),
		};
	},
});

export const TOOLS: Tool[] = [
	listTasks,
	addTask,
	updateTask,
	completeTask,
	deleteTask,
	listProjects,
	getTimer,
	startTimerTool,
	stopTimerTool,
	addTimeEntry,
	timeReport,
	listEvents,
];
