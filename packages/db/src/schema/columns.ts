import { sql } from "drizzle-orm";
import { integer } from "drizzle-orm/sqlite-core";

/*
 * Bookkeeping columns every table shares. They are epoch seconds in the
 * database and a `Date` in code (Drizzle's `timestamp` mode). Instants the
 * app computes with are a different thing: plain integer epoch milliseconds
 * (see `migrations/README.md`).
 */

/** When the row was inserted; set by the database. */
export const createdAt = () =>
	integer("created_at", { mode: "timestamp" })
		.default(sql`(unixepoch())`)
		.notNull();

/** When the row last changed; set by Drizzle on every update. */
export const updatedAt = () =>
	integer("updated_at", { mode: "timestamp" })
		.default(sql`(unixepoch())`)
		.$onUpdate(() => /* @__PURE__ */ new Date())
		.notNull();
