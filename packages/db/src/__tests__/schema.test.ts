import { getTableName } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { schema } from "../schema";

describe("database schema", () => {
	it("registers the Better Auth tables", () => {
		const tables = [
			schema.user,
			schema.session,
			schema.account,
			schema.verification,
		];
		expect(tables.map((table) => getTableName(table))).toEqual([
			"user",
			"session",
			"account",
			"verification",
		]);
	});
});
