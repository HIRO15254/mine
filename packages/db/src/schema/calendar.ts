import { sql } from "drizzle-orm";
import {
	integer,
	primaryKey,
	sqliteTable,
	text,
} from "drizzle-orm/sqlite-core";

import { user } from "./auth";

/**
 * Per-calendar display choice. A calendar without a row falls back to the
 * "selected" flag from the user's Google calendar list.
 */
export const calendarPreference = sqliteTable(
	"calendar_preference",
	{
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		calendarId: text("calendar_id").notNull(),
		visible: integer("visible", { mode: "boolean" }).notNull(),
		updatedAt: integer("updated_at", { mode: "timestamp" })
			.default(sql`(unixepoch())`)
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
	},
	(table) => [primaryKey({ columns: [table.userId, table.calendarId] })]
);
