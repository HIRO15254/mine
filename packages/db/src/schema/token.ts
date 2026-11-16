import {
	index,
	integer,
	sqliteTable,
	text,
	uniqueIndex,
} from "drizzle-orm/sqlite-core";

import { user } from "./auth";
import { createdAt } from "./columns";

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
		createdAt: createdAt(),
	},
	(table) => [
		uniqueIndex("api_token_hash_idx").on(table.tokenHash),
		index("api_token_user_idx").on(table.userId),
	]
);

/**
 * The secret link to the home-screen widget page (`/widget/<token>`), at most
 * one per user. Like an API token only its hash is kept, but it can only read
 * that page: `/v1`, `/mcp` and `/trpc` never accept it.
 */
export const widgetToken = sqliteTable(
	"widget_token",
	{
		id: text("id").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		tokenHash: text("token_hash").notNull(),
		/** The first characters of the token, to recognise the link. */
		prefix: text("prefix").notNull(),
		/** Epoch milliseconds of the last time the page was drawn. */
		lastUsedAt: integer("last_used_at"),
		createdAt: createdAt(),
	},
	(table) => [
		uniqueIndex("widget_token_hash_idx").on(table.tokenHash),
		uniqueIndex("widget_token_user_idx").on(table.userId),
	]
);
