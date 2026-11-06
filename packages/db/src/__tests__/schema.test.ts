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

describe("calendar schema", () => {
	it("registers the calendar preference table", () => {
		expect(getTableName(schema.calendarPreference)).toBe("calendar_preference");
	});
});

describe("task schema", () => {
	it("registers the task tables", () => {
		const tables = [
			schema.project,
			schema.label,
			schema.task,
			schema.taskLabel,
			schema.taskCompletion,
		];
		expect(tables.map((table) => getTableName(table))).toEqual([
			"project",
			"label",
			"task",
			"task_label",
			"task_completion",
		]);
	});
});

describe("time schema", () => {
	it("registers the time tracking tables", () => {
		expect(getTableName(schema.timeEntry)).toBe("time_entry");
		expect(getTableName(schema.projectRate)).toBe("project_rate");
	});
});
