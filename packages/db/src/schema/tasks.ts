import { relations, sql } from "drizzle-orm";
import {
	type AnySQLiteColumn,
	index,
	integer,
	primaryKey,
	sqliteTable,
	text,
	uniqueIndex,
} from "drizzle-orm/sqlite-core";

import { user } from "./auth";

/** Theme color keys a project may use; the web maps them to Mine Design System tokens. */
export const PROJECT_COLORS = [
	"chart-1",
	"chart-2",
	"chart-3",
	"chart-4",
	"chart-5",
] as const;
export type ProjectColor = (typeof PROJECT_COLORS)[number];

const createdAt = () =>
	integer("created_at", { mode: "timestamp" })
		.default(sql`(unixepoch())`)
		.notNull();
const updatedAt = () =>
	integer("updated_at", { mode: "timestamp" })
		.default(sql`(unixepoch())`)
		.$onUpdate(() => /* @__PURE__ */ new Date())
		.notNull();

/** Shared by tasks and (later) time entries. Nested through parentId. */
export const project = sqliteTable(
	"project",
	{
		id: text("id").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		parentId: text("parent_id").references((): AnySQLiteColumn => project.id, {
			onDelete: "cascade",
		}),
		name: text("name").notNull(),
		color: text("color").$type<ProjectColor>().notNull().default("chart-1"),
		sortOrder: integer("sort_order").notNull().default(0),
		archived: integer("archived", { mode: "boolean" }).notNull().default(false),
		createdAt: createdAt(),
		updatedAt: updatedAt(),
	},
	(table) => [
		index("project_user_idx").on(table.userId),
		index("project_parent_idx").on(table.parentId),
	]
);

export const label = sqliteTable(
	"label",
	{
		id: text("id").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		name: text("name").notNull(),
		sortOrder: integer("sort_order").notNull().default(0),
		createdAt: createdAt(),
	},
	(table) => [uniqueIndex("label_user_name_idx").on(table.userId, table.name)]
);

/**
 * Dates are local calendar days (YYYY-MM-DD). A recurring task stays one row:
 * completing it logs a task_completion and moves its dates forward.
 */
export const task = sqliteTable(
	"task",
	{
		id: text("id").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		projectId: text("project_id").references(() => project.id, {
			onDelete: "set null",
		}),
		title: text("title").notNull(),
		note: text("note").notNull().default(""),
		/** 1 is the most urgent, 4 the default. */
		priority: integer("priority").notNull().default(4),
		/** 最速実行可能日: hidden from today's list before this day. */
		startDate: text("start_date"),
		/** 予定日 */
		scheduledDate: text("scheduled_date"),
		/** 予定の時刻 (HH:MM), placed on the calendar; only with scheduledDate. */
		scheduledTime: text("scheduled_time"),
		/** 締め切り */
		deadline: text("deadline"),
		/** JSON-encoded Recurrence, see @mine/api tasks/recurrence. */
		recurrence: text("recurrence"),
		estimateMinutes: integer("estimate_minutes"),
		completedAt: integer("completed_at", { mode: "timestamp" }),
		sortOrder: integer("sort_order").notNull().default(0),
		createdAt: createdAt(),
		updatedAt: updatedAt(),
	},
	(table) => [
		index("task_user_open_idx").on(table.userId, table.completedAt),
		index("task_project_idx").on(table.projectId),
	]
);

export const taskLabel = sqliteTable(
	"task_label",
	{
		taskId: text("task_id")
			.notNull()
			.references(() => task.id, { onDelete: "cascade" }),
		labelId: text("label_id")
			.notNull()
			.references(() => label.id, { onDelete: "cascade" }),
	},
	(table) => [
		primaryKey({ columns: [table.taskId, table.labelId] }),
		index("task_label_label_idx").on(table.labelId),
	]
);

/** One row per completed occurrence, including each round of a recurring task. */
export const taskCompletion = sqliteTable(
	"task_completion",
	{
		id: text("id").primaryKey(),
		taskId: text("task_id")
			.notNull()
			.references(() => task.id, { onDelete: "cascade" }),
		completedAt: integer("completed_at", { mode: "timestamp" }).notNull(),
		/** The completed occurrence's dates, restored when it is undone. */
		startDate: text("start_date"),
		scheduledDate: text("scheduled_date"),
		deadline: text("deadline"),
	},
	(table) => [index("task_completion_task_idx").on(table.taskId)]
);

export const projectRelations = relations(project, ({ many, one }) => ({
	parent: one(project, {
		fields: [project.parentId],
		references: [project.id],
		relationName: "project_parent",
	}),
	children: many(project, { relationName: "project_parent" }),
	tasks: many(task),
}));

export const taskRelations = relations(task, ({ many, one }) => ({
	project: one(project, { fields: [task.projectId], references: [project.id] }),
	labels: many(taskLabel),
	completions: many(taskCompletion),
}));

export const labelRelations = relations(label, ({ many }) => ({
	tasks: many(taskLabel),
}));

export const taskLabelRelations = relations(taskLabel, ({ one }) => ({
	task: one(task, { fields: [taskLabel.taskId], references: [task.id] }),
	label: one(label, { fields: [taskLabel.labelId], references: [label.id] }),
}));

export const taskCompletionRelations = relations(taskCompletion, ({ one }) => ({
	task: one(task, { fields: [taskCompletion.taskId], references: [task.id] }),
}));
