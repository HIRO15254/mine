import { relations, sql } from "drizzle-orm";
import {
	index,
	integer,
	sqliteTable,
	text,
	uniqueIndex,
} from "drizzle-orm/sqlite-core";

import { user } from "./auth";

/**
 * OAuth clients registered dynamically by MCP clients such as Claude.
 * Public clients have no secret; confidential ones keep only its hash.
 */
export const oauthClient = sqliteTable("oauth_client", {
	id: text("id").primaryKey(),
	name: text("name").notNull(),
	/** JSON array of exact redirect URIs. */
	redirectUris: text("redirect_uris").notNull(),
	secretHash: text("secret_hash"),
	createdAt: integer("created_at", { mode: "timestamp" })
		.default(sql`(unixepoch())`)
		.notNull(),
});

/** Short-lived, single-use authorization codes (stored hashed). */
export const oauthCode = sqliteTable(
	"oauth_code",
	{
		codeHash: text("code_hash").primaryKey(),
		clientId: text("client_id")
			.notNull()
			.references(() => oauthClient.id, { onDelete: "cascade" }),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		redirectUri: text("redirect_uri").notNull(),
		codeChallenge: text("code_challenge").notNull(),
		scope: text("scope").notNull().default(""),
		/** Epoch milliseconds. */
		expiresAt: integer("expires_at").notNull(),
	},
	(table) => [index("oauth_code_expires_idx").on(table.expiresAt)]
);

/**
 * One row per connected app: the current access and refresh tokens, which
 * rotate together on every refresh. Deleting the row disconnects the app.
 */
export const oauthGrant = sqliteTable(
	"oauth_grant",
	{
		id: text("id").primaryKey(),
		clientId: text("client_id")
			.notNull()
			.references(() => oauthClient.id, { onDelete: "cascade" }),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		accessHash: text("access_hash").notNull(),
		refreshHash: text("refresh_hash").notNull(),
		/** Epoch milliseconds. */
		accessExpiresAt: integer("access_expires_at").notNull(),
		/** Epoch milliseconds. */
		refreshExpiresAt: integer("refresh_expires_at").notNull(),
		scope: text("scope").notNull().default(""),
		lastUsedAt: integer("last_used_at", { mode: "timestamp" }),
		createdAt: integer("created_at", { mode: "timestamp" })
			.default(sql`(unixepoch())`)
			.notNull(),
	},
	(table) => [
		uniqueIndex("oauth_grant_access_idx").on(table.accessHash),
		uniqueIndex("oauth_grant_refresh_idx").on(table.refreshHash),
		index("oauth_grant_user_idx").on(table.userId),
	]
);

export const oauthGrantRelations = relations(oauthGrant, ({ one }) => ({
	client: one(oauthClient, {
		fields: [oauthGrant.clientId],
		references: [oauthClient.id],
	}),
	user: one(user, { fields: [oauthGrant.userId], references: [user.id] }),
}));
