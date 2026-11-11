import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { createDb, type D1Database } from "@mine/db";

const MIGRATIONS_DIR = path.resolve(
	import.meta.dirname,
	"../../../db/src/migrations"
);

/** Minimal D1 stand-in over node:sqlite, with the real migrations applied. */
export function createTestDb() {
	const sqlite = new DatabaseSync(":memory:");
	sqlite.exec("PRAGMA foreign_keys = ON");
	for (const file of readdirSync(MIGRATIONS_DIR)
		.filter((name) => name.endsWith(".sql"))
		.sort()) {
		for (const statement of readFileSync(
			path.join(MIGRATIONS_DIR, file),
			"utf8"
		).split("--> statement-breakpoint")) {
			if (statement.trim()) {
				sqlite.exec(statement);
			}
		}
	}

	const prepare = (query: string) => {
		let params: SQLInputValue[] = [];
		const statement = {
			bind(...values: SQLInputValue[]) {
				params = values;
				return statement;
			},
			all() {
				const results = sqlite.prepare(query).all(...params);
				return Promise.resolve({ results, success: true, meta: {} });
			},
			raw() {
				const stmt = sqlite.prepare(query);
				stmt.setReturnArrays(true);
				return Promise.resolve(stmt.all(...params));
			},
			run() {
				const meta = sqlite.prepare(query).run(...params);
				return Promise.resolve({ results: [], success: true, meta });
			},
			first() {
				return Promise.resolve(sqlite.prepare(query).get(...params) ?? null);
			},
		};
		return statement;
	};

	/**
	 * Like D1: the statements run in one transaction, all or nothing, and
	 * nothing else runs between them (node:sqlite is synchronous underneath).
	 */
	const batch = (statements: ReturnType<typeof prepare>[]) => {
		sqlite.exec("BEGIN");
		try {
			const results = statements.map((statement) => statement.all());
			sqlite.exec("COMMIT");
			return Promise.all(results);
		} catch (error) {
			sqlite.exec("ROLLBACK");
			return Promise.reject(error);
		}
	};

	const d1 = { batch, prepare } as unknown as D1Database;
	return { d1, db: createDb(d1), sqlite };
}
