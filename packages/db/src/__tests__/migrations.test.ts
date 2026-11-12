import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
	MIGRATIONS_DIR,
	migrationFiles,
	migrationStatements,
} from "../testing";

/**
 * Statements that can destroy rows without saying so. A table rebuild drops
 * the old table, and with foreign keys on that deletes every row pointing at
 * it (`on delete cascade`); turning foreign keys off hides broken references.
 * A migration that needs one is listed here with the reason it is safe, so
 * the choice is made on purpose and shows up in review.
 */
const RISKY = [
	{ name: "DROP TABLE", pattern: /\bdrop\s+table\b/i },
	{ name: "PRAGMA foreign_keys", pattern: /\bpragma\s+foreign_keys\b/i },
	{ name: "DELETE FROM", pattern: /\bdelete\s+from\b/i },
];

/** `file: reason`, for migrations allowed to use a risky statement. */
const ALLOWED: Record<string, string> = {};

const files = migrationFiles();

describe("migrations", () => {
	it("are the ones the journal lists, in order", () => {
		const journal = JSON.parse(
			readFileSync(path.join(MIGRATIONS_DIR, "meta/_journal.json"), "utf8")
		) as { entries: { idx: number; tag: string }[] };

		expect(journal.entries.map((entry) => `${entry.tag}.sql`)).toEqual(files);
		expect(journal.entries.map((entry) => entry.idx)).toEqual(
			files.map((_, index) => index)
		);
	});

	it("are numbered without gaps", () => {
		expect(files.map((file) => file.slice(0, 4))).toEqual(
			files.map((_, index) => String(index).padStart(4, "0"))
		);
	});

	it("do not drop tables, delete rows or switch off foreign keys unnoticed", () => {
		const found = files.flatMap((file) =>
			migrationStatements(file).flatMap((statement) =>
				RISKY.filter((risk) => risk.pattern.test(statement)).map(
					(risk) => `${file}: ${risk.name}`
				)
			)
		);

		expect(
			found.filter((entry) => !((entry.split(":")[0] ?? "") in ALLOWED))
		).toEqual([]);
		// An entry that no longer matches anything is removed, not kept around.
		expect(
			Object.keys(ALLOWED).filter(
				(file) => !found.some((entry) => entry.startsWith(`${file}:`))
			)
		).toEqual([]);
	});
});
