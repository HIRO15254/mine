import { getTableName, is } from "drizzle-orm";
import { getTableConfig, SQLiteTable } from "drizzle-orm/sqlite-core";
import { describe, expect, it } from "vitest";

import { schema } from "../schema";
import { createTestDb } from "../testing";

/**
 * Columns the Drizzle tables no longer have but the database still does,
 * as `table.column`. Dropping a column takes two pushes (see the migrations
 * README): the first removes it from the code and lists it here, the second
 * adds the migration and takes it off this list.
 */
const PENDING_DROPS: string[] = [];

const tables = (Object.values(schema) as unknown[])
	.filter((value): value is SQLiteTable => is(value, SQLiteTable))
	.map((table) => getTableConfig(table));

const { sqlite } = createTestDb();

function rows<T>(query: string): T[] {
	return sqlite.prepare(query).all() as T[];
}

/** What the migrations built, in the words the Drizzle tables use. */
function migrated(table: string) {
	const columns = rows<{
		name: string;
		notnull: number;
		pk: number;
		type: string;
	}>(`PRAGMA table_info("${table}")`);
	const indexes = rows<{ name: string; origin: string; unique: number }>(
		`PRAGMA index_list("${table}")`
	)
		// "c" marks an index made by CREATE INDEX, not by a key or constraint.
		.filter((index) => index.origin === "c")
		.map((index) => ({
			columns: rows<{ name: string | null }>(
				`PRAGMA index_info("${index.name}")`
			).map((column) => column.name),
			name: index.name,
			unique: index.unique === 1,
		}));
	const foreignKeys = rows<{
		from: string;
		on_delete: string;
		table: string;
		to: string;
	}>(`PRAGMA foreign_key_list("${table}")`).map(
		(key) =>
			`${key.from} -> ${key.table}.${key.to} on delete ${key.on_delete.toLowerCase()}`
	);
	return {
		columns: columns.map((column) => ({
			name: column.name,
			notNull: column.notnull === 1 || column.pk > 0,
			primary: column.pk > 0,
			type: column.type.toLowerCase(),
		})),
		foreignKeys: foreignKeys.sort(),
		indexes: indexes.sort((a, b) => a.name.localeCompare(b.name)),
	};
}

/** The same description, read from a Drizzle table. */
function declared(table: (typeof tables)[number]) {
	const compositeKey = new Set(
		table.primaryKeys.flatMap((key) => key.columns.map((column) => column.name))
	);
	return {
		columns: table.columns.map((column) => {
			const primary = column.primary || compositeKey.has(column.name);
			return {
				name: column.name,
				notNull: column.notNull || primary,
				primary,
				type: column.getSQLType().toLowerCase(),
			};
		}),
		foreignKeys: table.foreignKeys
			.map((key) => {
				const { columns, foreignColumns, foreignTable } = key.reference();
				return `${columns[0]?.name} -> ${getTableName(foreignTable)}.${foreignColumns[0]?.name} on delete ${key.onDelete ?? "no action"}`;
			})
			.sort(),
		indexes: [
			...table.indexes.map((index) => ({
				columns: index.config.columns.map((column) =>
					"name" in column ? column.name : null
				),
				name: index.config.name,
				unique: index.config.unique,
			})),
			// `.unique()` on a column is a unique index under the column's name.
			...table.columns
				.filter((column) => column.isUnique)
				.map((column) => ({
					columns: [column.name],
					name: column.uniqueName ?? "",
					unique: true,
				})),
		].sort((a, b) => a.name.localeCompare(b.name)),
	};
}

describe("the schema and the migrations", () => {
	it("create the same tables", () => {
		const built = rows<{ name: string }>(
			"SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'"
		).map((row) => row.name);

		expect(built.sort()).toEqual(tables.map((table) => table.name).sort());
	});

	it.each(
		tables.map((table) => [table.name, table] as const)
	)("agree on %s", (name, table) => {
		const database = migrated(name);
		const pending = new Set(
			PENDING_DROPS.filter((entry) => entry.startsWith(`${name}.`)).map(
				(entry) => entry.slice(name.length + 1)
			)
		);
		const byName = (a: { name: string }, b: { name: string }) =>
			a.name.localeCompare(b.name);

		expect({
			...database,
			columns: database.columns
				.filter((column) => !pending.has(column.name))
				.sort(byName),
		}).toEqual({
			...declared(table),
			columns: declared(table).columns.sort(byName),
		});
	});

	it("lists only columns that are really waiting to be dropped", () => {
		const stale = PENDING_DROPS.filter((entry) => {
			const [table = "", column = ""] = entry.split(".");
			const inDatabase = migrated(table).columns.some(
				(candidate) => candidate.name === column
			);
			const inCode = tables
				.find((candidate) => candidate.name === table)
				?.columns.some((candidate) => candidate.name === column);
			return !inDatabase || inCode;
		});

		expect(stale).toEqual([]);
	});
});
