import { sql } from "drizzle-orm";
import {
	index,
	integer,
	sqliteTable,
	text,
	uniqueIndex,
} from "drizzle-orm/sqlite-core";

import { user } from "./auth";

/**
 * Personal API tokens for third-party apps and shortcuts. Only a SHA-256
 * hash is stored; the token itself is shown once when it is created.
 */
export const apiToken = sqliteTable(
	"api_token",
	{
		id: text("id").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		name: text("name").notNull(),
		tokenHash: text("token_hash").notNull(),
		/** The first characters of the token, to tell tokens apart. */
		prefix: text("prefix").notNull(),
		lastUsedAt: integer("last_used_at", { mode: "timestamp" }),
		createdAt: integer("created_at", { mode: "timestamp" })
			.default(sql`(unixepoch())`)
			.notNull(),
	},
	(table) => [
		uniqueIndex("api_token_hash_idx").on(table.tokenHash),
		index("api_token_user_idx").on(table.userId),
	]
);
