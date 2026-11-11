import { relations, sql } from "drizzle-orm";
import {
	index,
	integer,
	sqliteTable,
	text,
	uniqueIndex,
} from "drizzle-orm/sqlite-core";

import { user } from "./auth";
import { project, task } from "./tasks";

/**
 * One block of tracked time. Times are epoch milliseconds; a null endedAt is
 * the running timer (at most one per user, enforced by a partial index).
 */
export const timeEntry = sqliteTable(
	"time_entry",
	{
		id: text("id").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		projectId: text("project_id").references(() => project.id, {
			onDelete: "set null",
		}),
		taskId: text("task_id").references(() => task.id, {
			onDelete: "set null",
		}),
		description: text("description").notNull().default(""),
		billable: integer("billable", { mode: "boolean" }).notNull().default(true),
		startedAt: integer("started_at").notNull(),
		endedAt: integer("ended_at"),
		createdAt: integer("created_at", { mode: "timestamp" })
			.default(sql`(unixepoch())`)
			.notNull(),
	},
	(table) => [
		index("time_entry_user_started_idx").on(table.userId, table.startedAt),
		index("time_entry_project_idx").on(table.projectId),
		index("time_entry_task_idx").on(table.taskId),
		uniqueIndex("time_entry_running_idx")
			.on(table.userId)
			.where(sql`${table.endedAt} is null`),
	]
);

/**
 * Hourly rate (whole yen) for a project from a local day onward.
 * Subprojects without their own rate inherit their parent's.
 */
export const projectRate = sqliteTable(
	"project_rate",
	{
		id: text("id").primaryKey(),
		projectId: text("project_id")
			.notNull()
			.references(() => project.id, { onDelete: "cascade" }),
		hourlyRate: integer("hourly_rate").notNull(),
		/** YYYY-MM-DD */
		effectiveFrom: text("effective_from").notNull(),
		createdAt: integer("created_at", { mode: "timestamp" })
			.default(sql`(unixepoch())`)
			.notNull(),
	},
	(table) => [
		uniqueIndex("project_rate_project_day_idx").on(
			table.projectId,
			table.effectiveFrom
		),
	]
);

export const timeEntryRelations = relations(timeEntry, ({ one }) => ({
	project: one(project, {
		fields: [timeEntry.projectId],
		references: [project.id],
	}),
	task: one(task, { fields: [timeEntry.taskId], references: [task.id] }),
}));

export const projectRateRelations = relations(projectRate, ({ one }) => ({
	project: one(project, {
		fields: [projectRate.projectId],
		references: [project.id],
	}),
}));
