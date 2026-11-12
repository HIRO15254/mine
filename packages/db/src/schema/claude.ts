import { relations } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { user } from "./auth";
import { createdAt } from "./columns";
import { project } from "./tasks";

export const CLAUDE_THREAD_STATUSES = ["working", "waiting", "done"] as const;
export type ClaudeThreadStatus = (typeof CLAUDE_THREAD_STATUSES)[number];

/**
 * Claude conversations and sessions as they report themselves over MCP:
 * what each is doing and whether it is waiting for the user.
 */
export const claudeThread = sqliteTable(
	"claude_thread",
	{
		id: text("id").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		title: text("title").notNull(),
		/** Link back to the conversation, when Claude knows it. */
		url: text("url"),
		status: text("status", { enum: CLAUDE_THREAD_STATUSES }).notNull(),
		summary: text("summary").notNull().default(""),
		/** What the user needs to do, when the thread is waiting. */
		nextAction: text("next_action").notNull().default(""),
		projectId: text("project_id").references(() => project.id, {
			onDelete: "set null",
		}),
		/** Epoch milliseconds of the latest report. */
		updatedAt: integer("updated_at").notNull(),
		createdAt: createdAt(),
	},
	(table) => [
		index("claude_thread_user_idx").on(table.userId, table.updatedAt),
		index("claude_thread_url_idx").on(table.userId, table.url),
	]
);

export const claudeThreadRelations = relations(claudeThread, ({ one }) => ({
	project: one(project, {
		fields: [claudeThread.projectId],
		references: [project.id],
	}),
	user: one(user, { fields: [claudeThread.userId], references: [user.id] }),
}));
