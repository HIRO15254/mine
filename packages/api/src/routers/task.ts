import {
	label,
	project,
	task,
	taskCompletion,
	taskLabel,
} from "@mine/db/schema/tasks";
import { TRPCError } from "@trpc/server";
import { and, desc, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import { z } from "zod";

import type { Context } from "../context";
import { protectedProcedure, router } from "../index";
import { isDayKey } from "../tasks/dates";
import {
	advanceDates,
	parseRecurrence,
	recurrenceSchema,
	serializeRecurrence,
} from "../tasks/recurrence";
import { compareTasks, inView, TASK_VIEWS } from "../tasks/views";

type Db = Pick<Context, "db">;

const dayKey = z.string().refine(isDayKey, { message: "Expected YYYY-MM-DD" });

const taskFields = {
	deadline: dayKey.nullish(),
	estimateMinutes: z.number().int().min(1).max(10_000).nullish(),
	labelIds: z.array(z.string().min(1)).max(20).optional(),
	note: z.string().max(10_000).optional(),
	priority: z.number().int().min(1).max(4).optional(),
	projectId: z.string().min(1).nullish(),
	recurrence: recurrenceSchema.nullish(),
	scheduledDate: dayKey.nullish(),
	startDate: dayKey.nullish(),
	title: z.string().trim().min(1).max(500),
};

type TaskRow = typeof task.$inferSelect;

function toTask(row: TaskRow, labels: Array<{ id: string; name: string }>) {
	return {
		completedAt: row.completedAt,
		createdAt: row.createdAt,
		deadline: row.deadline,
		estimateMinutes: row.estimateMinutes,
		id: row.id,
		labels,
		note: row.note,
		priority: row.priority,
		projectId: row.projectId,
		recurrence: parseRecurrence(row.recurrence),
		scheduledDate: row.scheduledDate,
		sortOrder: row.sortOrder,
		startDate: row.startDate,
		title: row.title,
	};
}

export type Task = ReturnType<typeof toTask>;

async function labelsByTask(ctx: Db, userId: string) {
	const rows = await ctx.db
		.select({ id: label.id, name: label.name, taskId: taskLabel.taskId })
		.from(taskLabel)
		.innerJoin(label, eq(label.id, taskLabel.labelId))
		.where(eq(label.userId, userId))
		.orderBy(label.sortOrder, label.name);
	const byTask = new Map<string, Array<{ id: string; name: string }>>();
	for (const row of rows) {
		const list = byTask.get(row.taskId) ?? [];
		list.push({ id: row.id, name: row.name });
		byTask.set(row.taskId, list);
	}
	return byTask;
}

async function findTask(ctx: Db, userId: string, id: string) {
	const [row] = await ctx.db
		.select()
		.from(task)
		.where(and(eq(task.id, id), eq(task.userId, userId)))
		.limit(1);
	if (!row) {
		throw new TRPCError({ code: "NOT_FOUND", message: "Task not found" });
	}
	return row;
}

async function loadTask(ctx: Db, userId: string, id: string): Promise<Task> {
	const row = await findTask(ctx, userId, id);
	return toTask(row, (await labelsByTask(ctx, userId)).get(id) ?? []);
}

async function assertProject(ctx: Db, userId: string, projectId: string) {
	const [row] = await ctx.db
		.select({ id: project.id })
		.from(project)
		.where(and(eq(project.id, projectId), eq(project.userId, userId)))
		.limit(1);
	if (!row) {
		throw new TRPCError({ code: "BAD_REQUEST", message: "Unknown project" });
	}
}

async function setLabels(
	ctx: Db,
	userId: string,
	taskId: string,
	labelIds: string[]
) {
	const unique = [...new Set(labelIds)];
	if (unique.length > 0) {
		const owned = await ctx.db
			.select({ id: label.id })
			.from(label)
			.where(and(eq(label.userId, userId), inArray(label.id, unique)));
		if (owned.length !== unique.length) {
			throw new TRPCError({ code: "BAD_REQUEST", message: "Unknown label" });
		}
	}
	await ctx.db.delete(taskLabel).where(eq(taskLabel.taskId, taskId));
	if (unique.length > 0) {
		await ctx.db
			.insert(taskLabel)
			.values(unique.map((labelId) => ({ labelId, taskId })));
	}
}

export const taskRouter = router({
	list: protectedProcedure
		.input(
			z.object({
				projectId: z.string().min(1).optional(),
				today: dayKey,
				view: z.enum(TASK_VIEWS),
			})
		)
		.query(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			const conditions = [eq(task.userId, userId), isNull(task.completedAt)];
			if (input.projectId) {
				conditions.push(eq(task.projectId, input.projectId));
			}
			const [rows, labels] = await Promise.all([
				ctx.db
					.select()
					.from(task)
					.where(and(...conditions)),
				labelsByTask(ctx, userId),
			]);
			return rows
				.map((row) => toTask(row, labels.get(row.id) ?? []))
				.filter((item) => inView(item, input.view, input.today))
				.sort(compareTasks);
		}),

	completed: protectedProcedure
		.input(z.object({ limit: z.number().int().min(1).max(200).default(50) }))
		.query(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			const [rows, labels] = await Promise.all([
				ctx.db
					.select()
					.from(task)
					.where(and(eq(task.userId, userId), isNotNull(task.completedAt)))
					.orderBy(desc(task.completedAt))
					.limit(input.limit),
				labelsByTask(ctx, userId),
			]);
			return rows.map((row) => toTask(row, labels.get(row.id) ?? []));
		}),

	create: protectedProcedure
		.input(z.object(taskFields))
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			if (input.projectId) {
				await assertProject(ctx, userId, input.projectId);
			}
			const id = crypto.randomUUID();
			await ctx.db.insert(task).values({
				deadline: input.deadline ?? null,
				estimateMinutes: input.estimateMinutes ?? null,
				id,
				note: input.note ?? "",
				priority: input.priority ?? 4,
				projectId: input.projectId ?? null,
				recurrence: serializeRecurrence(input.recurrence ?? null),
				scheduledDate: input.scheduledDate ?? null,
				startDate: input.startDate ?? null,
				title: input.title,
				userId,
			});
			if (input.labelIds?.length) {
				await setLabels(ctx, userId, id, input.labelIds);
			}
			return loadTask(ctx, userId, id);
		}),

	update: protectedProcedure
		.input(
			z.object({
				...taskFields,
				id: z.string().min(1),
				title: taskFields.title.optional(),
			})
		)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			await findTask(ctx, userId, input.id);
			if (input.projectId) {
				await assertProject(ctx, userId, input.projectId);
			}
			const { id, labelIds, recurrence, ...fields } = input;
			const changes = Object.fromEntries(
				Object.entries(fields).filter(([, value]) => value !== undefined)
			);
			if (recurrence !== undefined) {
				changes.recurrence = serializeRecurrence(recurrence);
			}
			if (Object.keys(changes).length > 0) {
				await ctx.db
					.update(task)
					.set(changes)
					.where(and(eq(task.id, id), eq(task.userId, userId)));
			}
			if (labelIds) {
				await setLabels(ctx, userId, id, labelIds);
			}
			return loadTask(ctx, userId, id);
		}),

	/** Completes the task, or moves a recurring task to its next occurrence. */
	complete: protectedProcedure
		.input(z.object({ id: z.string().min(1), today: dayKey }))
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			const row = await findTask(ctx, userId, input.id);
			if (row.completedAt) {
				return { recurring: false, task: await loadTask(ctx, userId, row.id) };
			}
			const now = new Date();
			await ctx.db.insert(taskCompletion).values({
				completedAt: now,
				deadline: row.deadline,
				id: crypto.randomUUID(),
				scheduledDate: row.scheduledDate,
				startDate: row.startDate,
				taskId: row.id,
			});
			const rule = parseRecurrence(row.recurrence);
			await ctx.db
				.update(task)
				.set(rule ? advanceDates(rule, row, input.today) : { completedAt: now })
				.where(eq(task.id, row.id));
			return {
				recurring: rule !== null,
				task: await loadTask(ctx, userId, row.id),
			};
		}),

	/** Undoes the most recent completion, restoring a recurring task's dates. */
	uncomplete: protectedProcedure
		.input(z.object({ id: z.string().min(1) }))
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			const row = await findTask(ctx, userId, input.id);
			const [last] = await ctx.db
				.select()
				.from(taskCompletion)
				.where(eq(taskCompletion.taskId, row.id))
				.orderBy(desc(taskCompletion.completedAt))
				.limit(1);
			if (!last) {
				return loadTask(ctx, userId, row.id);
			}
			await ctx.db
				.update(task)
				.set(
					row.completedAt
						? { completedAt: null }
						: {
								deadline: last.deadline,
								scheduledDate: last.scheduledDate,
								startDate: last.startDate,
							}
				)
				.where(eq(task.id, row.id));
			await ctx.db.delete(taskCompletion).where(eq(taskCompletion.id, last.id));
			return loadTask(ctx, userId, row.id);
		}),

	delete: protectedProcedure
		.input(z.object({ id: z.string().min(1) }))
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			await findTask(ctx, userId, input.id);
			await ctx.db
				.delete(task)
				.where(and(eq(task.id, input.id), eq(task.userId, userId)));
			return { id: input.id };
		}),
});
