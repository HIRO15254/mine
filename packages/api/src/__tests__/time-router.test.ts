import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { createContextFactory } from "../context";
import { appRouter } from "../routers/index";
import { createTestDb } from "./d1";

const HOUR = 3_600_000;
const NOV5 = Date.UTC(2026, 10, 4, 15);

async function setup() {
	const { db, sqlite } = createTestDb();
	for (const id of ["u1", "u2"]) {
		sqlite
			.prepare("insert into user (id, name, email) values (?, ?, ?)")
			.run(id, id, `${id}@example.com`);
	}
	const clock = { now: NOV5 };
	const callerFor = async (id: string) =>
		appRouter.createCaller(
			await createContextFactory(
				db,
				() => Promise.resolve({ user: { id, email: `${id}@x`, name: id } }),
				{ now: () => clock.now }
			)()
		);
	return {
		clock,
		me: await callerFor("u1"),
		other: await callerFor("u2"),
		sqlite,
	};
}

describe("time router", () => {
	it("runs one timer at a time", async () => {
		const { clock, me } = await setup();
		const work = await me.project.create({ name: "仕事" });
		const report = await me.task.create({
			projectId: work.id,
			title: "報告書",
		});

		const first = await me.time.start({ taskId: report.id });
		expect(first).toMatchObject({
			description: "報告書",
			endedAt: null,
			projectId: work.id,
			startedAt: NOV5,
			taskId: report.id,
		});
		expect(await me.time.current()).toMatchObject({ id: first.id });

		clock.now += HOUR;
		const second = await me.time.start({ description: "メール" });
		expect(second).toMatchObject({ projectId: null, startedAt: NOV5 + HOUR });

		const entries = await me.time.list({ from: NOV5, to: NOV5 + 2 * HOUR });
		expect(entries.map((entry) => [entry.description, entry.endedAt])).toEqual([
			["メール", null],
			["報告書", NOV5 + HOUR],
		]);

		clock.now += HOUR / 2;
		await expect(me.time.stop()).resolves.toMatchObject({
			endedAt: NOV5 + 1.5 * HOUR,
		});
		await expect(me.time.current()).resolves.toBeNull();
		await expect(me.time.stop()).resolves.toBeNull();
	});

	it("never leaves two timers running", async () => {
		const { me, sqlite } = await setup();

		await Promise.all([
			me.time.start({ description: "一つ目" }),
			me.time.start({ description: "二つ目" }),
		]);

		expect(
			sqlite
				.prepare(
					"select count(*) as total, count(ended_at) as ended from time_entry"
				)
				.get()
		).toEqual({ ended: 1, total: 2 });
		// The database refuses a second one whatever the caller does.
		expect(() =>
			sqlite
				.prepare(
					"insert into time_entry (id, user_id, started_at) values ('x', 'u1', 1)"
				)
				.run()
		).toThrow();
	});

	it("closes all but the newest running entry when the rule arrives", async () => {
		const { sqlite } = await setup();
		sqlite.exec("drop index time_entry_running_idx");
		const insert = sqlite.prepare(
			"insert into time_entry (id, user_id, started_at) values (?, ?, ?)"
		);
		insert.run("a", "u1", 100);
		insert.run("b", "u1", 300);
		insert.run("c", "u1", 200);
		insert.run("d", "u2", 50);

		const migration = readFileSync(
			path.resolve(
				import.meta.dirname,
				"../../../db/src/migrations/0008_single_running_timer.sql"
			),
			"utf8"
		);
		for (const statement of migration.split("--> statement-breakpoint")) {
			sqlite.exec(statement);
		}

		expect(
			sqlite.prepare("select id, ended_at from time_entry order by id").all()
		).toEqual([
			{ ended_at: 300, id: "a" },
			{ ended_at: null, id: "b" },
			{ ended_at: 300, id: "c" },
			{ ended_at: null, id: "d" },
		]);
	});

	it("gives a manual entry its task's project and title", async () => {
		const { me } = await setup();
		const work = await me.project.create({ name: "仕事" });
		const report = await me.task.create({
			projectId: work.id,
			title: "報告書",
		});
		const span = { endedAt: NOV5 + HOUR, startedAt: NOV5 };

		await expect(
			me.time.create({ ...span, taskId: report.id })
		).resolves.toMatchObject({ description: "報告書", projectId: work.id });
		await expect(
			me.time.create({
				...span,
				description: "下書き",
				projectId: null,
				taskId: report.id,
			})
		).resolves.toMatchObject({ description: "下書き", projectId: null });
	});

	it("backdates a start and ends the running entry there", async () => {
		const { clock, me } = await setup();
		await me.time.start({ description: "メール" });
		clock.now += HOUR;

		const seminar = await me.time.start({
			description: "ゼミ",
			startedAt: NOV5 + HOUR / 2,
		});
		expect(seminar).toMatchObject({
			endedAt: null,
			startedAt: NOV5 + HOUR / 2,
		});
		const entries = await me.time.list({ from: NOV5, to: NOV5 + 2 * HOUR });
		expect(entries.map((entry) => [entry.description, entry.endedAt])).toEqual([
			["ゼミ", null],
			["メール", NOV5 + HOUR / 2],
		]);

		await expect(
			me.time.start({ description: "未来", startedAt: clock.now + 1 })
		).rejects.toThrow();
	});

	it("renames an entry a forgotten timer left running for days", async () => {
		const { clock, me } = await setup();
		const started = await me.time.start({ description: "消し忘れ" });
		clock.now += 8 * 24 * HOUR;
		await me.time.stop();

		await expect(
			me.time.update({ description: "調査", id: started.id })
		).resolves.toMatchObject({ description: "調査" });
		// Changing the span is still checked.
		await expect(
			me.time.update({ id: started.id, startedAt: NOV5 + 1 })
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
	});

	it("validates manual entries and edits", async () => {
		const { me, other } = await setup();
		const project = await me.project.create({ name: "仕事" });

		await expect(
			me.time.create({ endedAt: NOV5, startedAt: NOV5 + HOUR })
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
		await expect(
			me.time.create({ endedAt: NOV5 + 8 * 24 * HOUR, startedAt: NOV5 })
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
		await expect(
			other.time.create({
				endedAt: NOV5 + HOUR,
				projectId: project.id,
				startedAt: NOV5,
			})
		).rejects.toMatchObject({ code: "BAD_REQUEST" });

		const entry = await me.time.create({
			billable: false,
			description: "会議",
			endedAt: NOV5 + HOUR,
			projectId: project.id,
			startedAt: NOV5,
		});
		await expect(
			me.time.update({ endedAt: NOV5 - HOUR, id: entry.id })
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
		await expect(
			me.time.update({
				endedAt: NOV5 + 2 * HOUR,
				id: entry.id,
				projectId: null,
			})
		).resolves.toMatchObject({ endedAt: NOV5 + 2 * HOUR, projectId: null });
		await expect(other.time.delete({ id: entry.id })).rejects.toMatchObject({
			code: "NOT_FOUND",
		});
		await me.time.delete({ id: entry.id });
		await expect(
			me.time.list({ from: NOV5, to: NOV5 + HOUR })
		).resolves.toEqual([]);
		await expect(
			me.time.list({ from: NOV5, to: NOV5 + 90 * 24 * HOUR })
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
	});

	it("prices time with inherited rates", async () => {
		const { me, other } = await setup();
		const work = await me.project.create({ name: "仕事" });
		const client = await me.project.create({ name: "案件", parentId: work.id });

		await me.rate.set({
			effectiveFrom: "2026-11-01",
			hourlyRate: 1000,
			projectId: work.id,
		});
		const replaced = await me.rate.set({
			effectiveFrom: "2026-11-01",
			hourlyRate: 1500,
			projectId: work.id,
		});
		await expect(me.rate.list()).resolves.toEqual([replaced]);
		await expect(
			other.rate.set({
				effectiveFrom: "2026-11-01",
				hourlyRate: 1,
				projectId: work.id,
			})
		).rejects.toMatchObject({ code: "NOT_FOUND" });
		await expect(other.rate.delete({ id: replaced.id })).rejects.toMatchObject({
			code: "NOT_FOUND",
		});

		await me.time.create({
			endedAt: NOV5 + 2 * HOUR,
			projectId: client.id,
			startedAt: NOV5,
		});
		const summary = await me.time.summary({
			from: NOV5,
			timeZone: "Asia/Tokyo",
			to: NOV5 + 24 * HOUR,
		});
		expect(summary).toMatchObject({
			amount: 3000,
			days: [{ day: "2026-11-05", durationMs: 2 * HOUR }],
			durationMs: 2 * HOUR,
		});
		await expect(
			me.time.summary({ from: NOV5, timeZone: "Nowhere", to: NOV5 + HOUR })
		).rejects.toMatchObject({ code: "BAD_REQUEST" });

		await me.rate.delete({ id: replaced.id });
		await expect(me.rate.list()).resolves.toEqual([]);
	});
});
