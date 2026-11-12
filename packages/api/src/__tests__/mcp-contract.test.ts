import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { handleMcp, listTools } from "../mcp/server";
import { TOOLS, type ToolEnv } from "../mcp/tools";
import { createTestApp, TEST_USER } from "../testing";

/*
 * What every tool promises Claude, checked for all of them at once: it runs
 * with only its required arguments, it explains a bad call instead of
 * breaking, it changes nothing when it says it only reads, and it is in the
 * owner's document. A new tool fails here until it has a row in MINIMAL.
 */

// 2026-11-06 10:00 in Tokyo.
const NOW = Date.parse("2026-11-06T01:00:00Z");

const READ_ONLY_NAME = /^(list_|get_)|_report$/;
const TOOL_IN_DOCS = /`([a-z_]+)`/g;
const DOCS = path.resolve(
	import.meta.dirname,
	"../../../../docs/claude-mcp.ja.md"
);

interface Seed {
	taskId: string;
}

/** The fewest arguments each tool accepts: its required ones and no more. */
const MINIMAL: Record<string, (seed: Seed) => Record<string, unknown>> = {
	add_task: () => ({ title: "牛乳を買う" }),
	add_time_entry: () => ({
		end: "2026-11-06T09:30:00+09:00",
		start: "2026-11-06T09:00:00+09:00",
	}),
	complete_task: ({ taskId }) => ({ id: taskId }),
	delete_task: ({ taskId }) => ({ id: taskId }),
	get_timer: () => ({}),
	list_events: () => ({ from: "2026-11-06" }),
	list_projects: () => ({}),
	list_tasks: () => ({}),
	list_threads: () => ({}),
	report_thread_status: () => ({ status: "working", title: "論文の要約" }),
	start_timer: () => ({}),
	stop_timer: () => ({}),
	time_report: () => ({ from: "2026-11-06" }),
	update_task: ({ taskId }) => ({ id: taskId }),
};

/**
 * Tools that cannot succeed in a test, with the reason they give instead.
 * Google is not reachable here, and saying so by name is the contract.
 */
const REFUSES: Record<string, string> = {
	list_events: "GOOGLE_CALENDAR_NOT_CONNECTED",
};

/** A reference to something that does not exist, for each tool that takes one. */
const UNKNOWN: Record<string, Record<string, unknown>> = {
	add_task: { project: "無いプロジェクト", title: "牛乳を買う" },
	add_time_entry: {
		end: "2026-11-06T09:30:00+09:00",
		project: "無いプロジェクト",
		start: "2026-11-06T09:00:00+09:00",
	},
	complete_task: { id: "missing" },
	delete_task: { id: "missing" },
	report_thread_status: {
		project: "無いプロジェクト",
		status: "working",
		title: "論文の要約",
	},
	start_timer: { project: "無いプロジェクト" },
	update_task: { id: "missing", title: "変更" },
};

async function setup() {
	const app = await createTestApp({ now: NOW });
	const env: ToolEnv = {
		caller: await app.callerFor(TEST_USER, "api-token"),
		now: NOW,
		timeZone: "Asia/Tokyo",
	};
	const task = await app.caller.task.create({ title: "レポートを書く" });
	const call = async (name: string, args: Record<string, unknown>) => {
		const reply = (await handleMcp(
			JSON.stringify({
				id: 1,
				jsonrpc: "2.0",
				method: "tools/call",
				params: { arguments: args, name },
			}),
			() => env
		)) as {
			error?: unknown;
			result?: { content: Array<{ text: string }>; isError: boolean };
		};
		return {
			isError: reply.result?.isError,
			protocolError: reply.error,
			text: reply.result?.content[0]?.text ?? "",
		};
	};
	/** Rows written so far, as SQLite counts them. */
	const writes = () =>
		(
			app.sqlite.prepare("select total_changes() as n").get() as {
				n: number;
			}
		).n;
	return { call, seed: { taskId: task.id }, writes };
}

const tools = listTools();
const names = tools.map((tool) => tool.name);
const required = (name: string) =>
	(
		(tools.find((tool) => tool.name === name)?.inputSchema.required ??
			[]) as string[]
	).toSorted();

describe("every MCP tool", () => {
	it("has its smallest call written down here", () => {
		expect(Object.keys(MINIMAL).toSorted()).toEqual(names.toSorted());
		expect(new Set(names).size).toBe(names.length);
	});

	it.each(names)("%s runs with only its required arguments", async (name) => {
		const { call, seed } = await setup();
		const args = MINIMAL[name]?.(seed) ?? {};
		expect(Object.keys(args).toSorted()).toEqual(required(name));

		const reply = await call(name, args);

		expect(reply.protocolError).toBeUndefined();
		if (name in REFUSES) {
			expect(reply).toMatchObject({ isError: true, text: REFUSES[name] });
		} else {
			expect(reply.isError, reply.text).toBe(false);
			expect(() => JSON.parse(reply.text)).not.toThrow();
		}
	});

	it.each(
		names.filter((name) => required(name).length > 0)
	)("%s names what is missing from a call without arguments", async (name) => {
		const { call } = await setup();

		const reply = await call(name, {});

		expect(reply.protocolError).toBeUndefined();
		expect(reply.isError).toBe(true);
		for (const field of required(name)) {
			expect(reply.text).toContain(field);
		}
	});

	it.each(
		Object.entries(UNKNOWN)
	)("%s says so when it is pointed at something that does not exist", async (name, args) => {
		const { call, writes } = await setup();
		const before = writes();

		const reply = await call(name, args);

		expect(reply.isError).toBe(true);
		expect(reply.text).not.toBe("");
		expect(reply.text).not.toContain("Internal error");
		// A refused call leaves nothing half done.
		expect(writes()).toBe(before);
	});

	it.each(
		tools.filter((tool) => tool.annotations.readOnlyHint)
	)("$name changes nothing, as it says", async ({ name }) => {
		const { call, seed, writes } = await setup();
		const before = writes();

		await call(name, MINIMAL[name]?.(seed) ?? {});

		expect(writes()).toBe(before);
	});

	it("is marked read-only exactly when its name says it only reads", () => {
		const marked = TOOLS.filter((tool) => tool.annotations.readOnlyHint).map(
			(tool) => tool.name
		);

		expect(marked).toEqual(names.filter((name) => READ_ONLY_NAME.test(name)));
		expect(
			TOOLS.filter((tool) => tool.annotations.destructiveHint).map(
				(tool) => tool.name
			)
		).toEqual(names.filter((name) => name.startsWith("delete_")));
	});

	it("describes itself and takes an object", () => {
		for (const tool of tools) {
			expect(tool.inputSchema, tool.name).toMatchObject({ type: "object" });
			expect(tool.description.length, tool.name).toBeGreaterThan(20);
			expect(tool.title, tool.name).not.toBe("");
		}
	});

	it("is listed in docs/claude-mcp.ja.md, and nothing else is", () => {
		const table = readFileSync(DOCS, "utf8")
			.split("\n")
			.filter((line) => line.startsWith("| `"));
		const documented = table.flatMap((line) =>
			[...(line.split("|")[1] ?? "").matchAll(TOOL_IN_DOCS)].map(
				(match) => match[1] ?? ""
			)
		);

		expect(documented.toSorted()).toEqual(names.toSorted());
	});
});
