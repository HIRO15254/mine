import { describe, expect, it } from "vitest";

import { createContextFactory } from "../context";
import { handleMcp, listTools } from "../mcp/server";
import type { ToolEnv } from "../mcp/tools";
import { appRouter } from "../routers/index";
import { startOfDayIn, zoneOffsetMs } from "../time/zone";
import { createTestDb } from "./d1";

// 2026-11-06 10:00 in Tokyo.
const NOW = Date.parse("2026-11-06T01:00:00Z");
const TOKYO = "Asia/Tokyo";

async function setup() {
	const { db, sqlite } = createTestDb();
	sqlite
		.prepare("insert into user (id, name, email) values (?, ?, ?)")
		.run("u1", "Me", "me@example.com");
	sqlite.exec(`
		insert into project (id, user_id, name, parent_id) values
			('p1', 'u1', '大学', null),
			('p2', 'u1', '研究', 'p1'),
			('p3', 'u1', '生活', null);
		insert into label (id, user_id, name) values ('l1', 'u1', 'next');
	`);
	const ctx = await createContextFactory(
		db,
		() =>
			Promise.resolve({
				user: { email: "me@example.com", id: "u1", name: "Me" },
				via: "token" as const,
			}),
		{ now: () => NOW }
	)();
	const env: ToolEnv = {
		caller: appRouter.createCaller(ctx),
		now: NOW,
		timeZone: TOKYO,
	};
	let nextId = 1;
	const rpc = async (method: string, params?: Record<string, unknown>) =>
		(await handleMcp(
			JSON.stringify({ id: nextId++, jsonrpc: "2.0", method, params }),
			() => env
		)) as {
			error?: { code: number; message: string };
			result?: Record<string, unknown>;
		};
	const call = async (name: string, args: Record<string, unknown> = {}) => {
		const reply = await rpc("tools/call", { arguments: args, name });
		const result = reply.result as {
			content: Array<{ text: string }>;
			isError: boolean;
		};
		const text = result.content[0]?.text ?? "";
		return {
			data: result.isError ? null : JSON.parse(text),
			isError: result.isError,
			text,
		};
	};
	return { call, rpc };
}

describe("time zone helpers", () => {
	it("finds the start of a local day", () => {
		expect(zoneOffsetMs(NOW, TOKYO)).toBe(9 * 3_600_000);
		expect(new Date(startOfDayIn("2026-11-06", TOKYO)).toISOString()).toBe(
			"2026-11-05T15:00:00.000Z"
		);
		expect(
			new Date(startOfDayIn("2026-07-01", "America/New_York")).toISOString()
		).toBe("2026-07-01T04:00:00.000Z");
	});
});

describe("MCP protocol", () => {
	it("initializes and lists tools with object schemas", async () => {
		const { rpc } = await setup();
		const init = await rpc("initialize", {
			capabilities: {},
			clientInfo: { name: "test", version: "1" },
			protocolVersion: "2025-03-26",
		});
		expect(init.result).toMatchObject({
			capabilities: { tools: {} },
			protocolVersion: "2025-03-26",
			serverInfo: { name: "mine" },
		});
		expect(
			(await rpc("initialize", { protocolVersion: "1999-01-01" })).result
		).toMatchObject({ protocolVersion: "2025-06-18" });

		const tools = listTools();
		expect(tools.map((tool) => tool.name)).toContain("add_task");
		for (const tool of tools) {
			expect(tool.inputSchema).toMatchObject({ type: "object" });
			expect(tool.inputSchema).not.toHaveProperty("$schema");
		}
		const list = await rpc("tools/list");
		expect((list.result?.tools as unknown[]).length).toBe(tools.length);
	});

	it("answers pings, ignores notifications and reports bad requests", async () => {
		const { rpc } = await setup();
		expect((await rpc("ping")).result).toEqual({});
		expect((await rpc("resources/list")).error?.code).toBe(-32_601);
		expect(
			(await rpc("tools/call", { arguments: {}, name: "nope" })).error?.code
		).toBe(-32_602);
		const env = () => {
			throw new Error("not used");
		};
		expect(
			await handleMcp(
				JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }),
				env
			)
		).toBeNull();
		const icon = {
			mimeType: "image/png",
			sizes: ["192x192"],
			src: "https://web.example.test/pwa-192x192.png",
		};
		expect(
			await handleMcp(
				JSON.stringify({ id: 1, jsonrpc: "2.0", method: "initialize" }),
				env,
				{ icons: [icon], websiteUrl: "https://web.example.test" }
			)
		).toMatchObject({
			result: {
				serverInfo: {
					icons: [icon],
					name: "mine",
					websiteUrl: "https://web.example.test",
				},
			},
		});
		expect(await handleMcp("{oops", env)).toMatchObject({
			error: { code: -32_700 },
		});
		expect(await handleMcp(JSON.stringify({ hello: 1 }), env)).toMatchObject({
			error: { code: -32_600 },
		});
		expect(
			await handleMcp(
				JSON.stringify([
					{ id: 1, jsonrpc: "2.0", method: "ping" },
					{ jsonrpc: "2.0", method: "notifications/initialized" },
				]),
				env
			)
		).toEqual([{ id: 1, jsonrpc: "2.0", result: {} }]);
	});
});

describe("MCP tools", () => {
	it("adds, lists, updates and completes tasks", async () => {
		const { call } = await setup();

		const added = await call("add_task", {
			deadline: "2026-11-06",
			labels: ["@next"],
			priority: 1,
			project: "大学 / 研究",
			title: "論文を読む",
		});
		expect(added.data.added).toMatchObject({
			deadline: "2026-11-06",
			labels: ["next"],
			priority: 1,
			project: "大学 / 研究",
			title: "論文を読む",
		});
		const id = added.data.added.id as string;
		await call("add_task", { title: "牛乳を買う" });

		const today = await call("list_tasks", { view: "today" });
		expect(today.data).toMatchObject({ count: 1, today: "2026-11-06" });
		const inUniversity = await call("list_tasks", {
			project: "大学",
			view: "open",
		});
		expect(inUniversity.data.count).toBe(1);
		const inbox = await call("list_tasks", { view: "inbox" });
		expect(inbox.data.tasks).toEqual([
			{ id: expect.any(String), priority: 4, title: "牛乳を買う" },
		]);
		const found = await call("list_tasks", { query: "牛乳", view: "open" });
		expect(found.data.count).toBe(1);

		const updated = await call("update_task", {
			deadline: null,
			id,
			project: null,
			scheduledDate: "2026-11-07",
		});
		expect(updated.data.updated).not.toHaveProperty("deadline");
		expect(updated.data.updated).not.toHaveProperty("project");
		expect(updated.data.updated.scheduledDate).toBe("2026-11-07");

		const done = await call("complete_task", { id });
		expect(done.data.text).toContain("完了しました");
		expect((await call("list_tasks", { view: "open" })).data.count).toBe(1);
	});

	it("explains unknown projects, labels and invalid input", async () => {
		const { call } = await setup();
		const project = await call("add_task", { project: "趣味", title: "x" });
		expect(project.isError).toBe(true);
		expect(project.text).toContain("大学 / 研究");
		const label = await call("add_task", { labels: ["PC"], title: "x" });
		expect(label.isError).toBe(true);
		expect(label.text).toContain("next");
		const date = await call("add_task", { deadline: "明日", title: "x" });
		expect(date.isError).toBe(true);
		const missing = await call("complete_task", { id: "nope" });
		expect(missing).toMatchObject({ isError: true, text: "Task not found" });
	});

	it("runs the timer and reports time", async () => {
		const { call } = await setup();
		expect((await call("get_timer")).data).toMatchObject({ running: false });
		const started = await call("start_timer", {
			description: "資料づくり",
			project: "生活",
		});
		expect(started.data).toMatchObject({ project: "生活", running: true });
		expect((await call("stop_timer")).data).toMatchObject({ stopped: true });

		const entry = await call("add_time_entry", {
			description: "論文",
			end: "2026-11-05T12:00:00+09:00",
			project: "研究",
			start: "2026-11-05T10:00:00+09:00",
		});
		expect(entry.data.added).toMatchObject({
			duration: "2:00",
			end: "2026-11-05 12:00",
			project: "大学 / 研究",
			start: "2026-11-05 10:00",
		});

		const report = await call("time_report", {
			from: "2026-11-05",
			to: "2026-11-06",
		});
		expect(report.data.total).toBe("2:00");
		expect(report.data.projects).toContainEqual({
			project: "大学 / 研究",
			total: "2:00",
		});
		expect(report.data.entries).toHaveLength(2);
		const backwards = await call("time_report", {
			from: "2026-11-06",
			to: "2026-11-05",
		});
		expect(backwards.isError).toBe(true);
	});

	it("lists projects and labels", async () => {
		const { call } = await setup();
		expect((await call("list_projects")).data).toEqual({
			labels: ["next"],
			projects: [
				{ id: "p1", path: "大学" },
				{ id: "p2", path: "大学 / 研究" },
				{ id: "p3", path: "生活" },
			],
		});
	});

	it("needs Google for events", async () => {
		const { call } = await setup();
		const events = await call("list_events", { from: "2026-11-06" });
		expect(events.isError).toBe(true);
		expect(events.text).toBe("GOOGLE_CALENDAR_NOT_CONNECTED");
	});
});

describe("Claude threads", () => {
	it("reports, updates and lists threads", async () => {
		const { call } = await setup();
		const first = await call("report_thread_status", {
			project: "研究",
			status: "working",
			summary: "論文の要約を作っています",
			title: "論文の要約",
			url: "https://claude.ai/chat/abc",
		});
		expect(first.data.text).toBe("記録しました: 論文の要約（作業中）");
		const id = first.data.id as string;

		const waiting = await call("report_thread_status", {
			id,
			nextAction: "要約の長さを決めてください",
			status: "waiting",
			title: "論文の要約",
		});
		expect(waiting.data.id).toBe(id);

		// The same URL updates the same thread even without the id.
		const again = await call("report_thread_status", {
			nextAction: "要約の長さを決めてください",
			status: "waiting",
			title: "論文の要約",
			url: "https://claude.ai/chat/abc",
		});
		expect(again.data.id).toBe(id);

		const list = await call("list_threads");
		expect(list.data.threads).toEqual([
			{
				id,
				nextAction: "要約の長さを決めてください",
				project: "大学 / 研究",
				status: "waiting",
				summary: "論文の要約を作っています",
				title: "論文の要約",
				updated: "2026-11-06 10:00",
				url: "https://claude.ai/chat/abc",
			},
		]);

		await call("report_thread_status", {
			id,
			status: "done",
			title: "論文の要約",
		});
		expect((await call("list_threads")).data.threads).toEqual([]);
		const all = await call("list_threads", { includeDone: true });
		expect(all.data.threads[0]).not.toHaveProperty("nextAction");
	});

	it("refuses script links and other users' threads", async () => {
		const { call } = await setup();
		const script = await call("report_thread_status", {
			status: "working",
			title: "x",
			url: "javascript:alert(1)",
		});
		expect(script.isError).toBe(true);
		const plain = await call("report_thread_status", {
			status: "working",
			title: "x",
			url: "http://claude.ai/chat/1",
		});
		expect(plain.isError).toBe(true);
		const missing = await call("report_thread_status", {
			id: "someone-else",
			status: "working",
			title: "x",
		});
		expect(missing).toMatchObject({ isError: true, text: "Thread not found" });
	});
});
