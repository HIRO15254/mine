import { describe, expect, it } from "vitest";

import { createContextFactory } from "../context";
import { appRouter } from "../routers/index";
import { createTestDb } from "./d1";

const today = "2026-11-05";

async function setup() {
	const { db, sqlite } = createTestDb();
	for (const [id, email] of [
		["u1", "me@example.com"],
		["u2", "other@example.com"],
	] as const) {
		sqlite
			.prepare("insert into user (id, name, email) values (?, ?, ?)")
			.run(id, id, email);
	}
	const callerFor = async (id: string) =>
		appRouter.createCaller(
			await createContextFactory(db, () =>
				Promise.resolve({ user: { id, email: `${id}@x`, name: id } })
			)()
		);
	return { me: await callerFor("u1"), other: await callerFor("u2"), sqlite };
}

describe("project router", () => {
	it("creates a hierarchy and rejects cycles", async () => {
		const { me } = await setup();
		const school = await me.project.create({ name: "大学" });
		const lab = await me.project.create({ name: "研究", parentId: school.id });
		const second = await me.project.create({ name: "仕事", color: "chart-2" });

		expect(await me.project.list()).toMatchObject([
			{ name: "大学", parentId: null, sortOrder: 0 },
			{ name: "研究", parentId: school.id, sortOrder: 0 },
			{ name: "仕事", color: "chart-2", sortOrder: 1 },
		]);
		await expect(
			me.project.update({ id: school.id, parentId: lab.id })
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
		await expect(
			me.project.update({ id: school.id, parentId: school.id })
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
		await expect(
			me.project.update({ id: second.id, name: "バイト", parentId: school.id })
		).resolves.toMatchObject({ name: "バイト", parentId: school.id });
		await expect(
			me.project.update({ id: second.id, parentId: null, archived: true })
		).resolves.toMatchObject({ archived: true, parentId: null });
		// Nothing to change is not an error.
		await expect(me.project.update({ id: second.id })).resolves.toMatchObject({
			archived: true,
			name: "バイト",
		});
	});

	it("moves tasks to the inbox when their project is deleted", async () => {
		const { me } = await setup();
		const school = await me.project.create({ name: "大学" });
		const lab = await me.project.create({ name: "研究", parentId: school.id });
		const created = await me.task.create({ title: "論文", projectId: lab.id });

		await me.project.delete({ id: school.id });

		expect(await me.project.list()).toEqual([]);
		const inbox = await me.task.list({ today, view: "inbox" });
		expect(inbox.map((t) => t.id)).toEqual([created.id]);
	});

	it("keeps users apart", async () => {
		const { me, other } = await setup();
		const mine = await me.project.create({ name: "大学" });

		expect(await other.project.list()).toEqual([]);
		await expect(other.project.delete({ id: mine.id })).rejects.toMatchObject({
			code: "NOT_FOUND",
		});
		await expect(
			other.project.create({ name: "x", parentId: mine.id })
		).rejects.toMatchObject({ code: "NOT_FOUND" });
		await expect(
			other.task.create({ title: "x", projectId: mine.id })
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
	});
});

describe("label router", () => {
	it("creates, renames and deletes labels with unique names", async () => {
		const { me, other } = await setup();
		const pc = await me.label.create({ name: "@PC" });
		await me.label.create({ name: "next" });

		await expect(me.label.create({ name: "@PC" })).rejects.toMatchObject({
			code: "CONFLICT",
		});
		await expect(other.label.create({ name: "@PC" })).resolves.toBeDefined();
		await expect(
			me.label.update({ id: pc.id, name: "next" })
		).rejects.toMatchObject({ code: "CONFLICT" });
		await expect(me.label.update({ id: pc.id, name: "@PC" })).resolves.toEqual({
			id: pc.id,
			name: "@PC",
		});
		await expect(
			other.label.update({ id: pc.id, name: "x" })
		).rejects.toMatchObject({ code: "NOT_FOUND" });
		await expect(other.label.delete({ id: pc.id })).rejects.toMatchObject({
			code: "NOT_FOUND",
		});
		await me.label.delete({ id: pc.id });
		expect((await me.label.list()).map((l) => l.name)).toEqual(["next"]);
	});
});

describe("task router", () => {
	it("places a task at a time on its scheduled day", async () => {
		const { me } = await setup();
		const created = await me.task.create({
			scheduledDate: today,
			scheduledTime: "09:30",
			title: "レポート",
		});
		expect(created).toMatchObject({ scheduledTime: "09:30" });

		await expect(
			me.task.update({ id: created.id, scheduledTime: "25:00" })
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
		await expect(
			me.task.update({ id: created.id, scheduledTime: "13:15" })
		).resolves.toMatchObject({ scheduledDate: today, scheduledTime: "13:15" });
		// Taking the day away takes the time with it.
		await expect(
			me.task.update({ id: created.id, scheduledDate: null })
		).resolves.toMatchObject({ scheduledDate: null, scheduledTime: null });
		// A time without a day is not kept.
		await expect(
			me.task.create({ scheduledTime: "10:00", title: "x" })
		).resolves.toMatchObject({ scheduledTime: null });
	});

	it("creates tasks with labels and lists them by view", async () => {
		const { me, other } = await setup();
		const next = await me.label.create({ name: "next" });
		const pc = await me.label.create({ name: "@PC" });
		const school = await me.project.create({ name: "大学" });

		const report = await me.task.create({
			deadline: "2026-11-10",
			labelIds: [pc.id, next.id, pc.id],
			priority: 1,
			projectId: school.id,
			startDate: "2026-11-01",
			title: "レポート",
		});
		await me.task.create({ scheduledDate: today, title: "買い物" });
		await me.task.create({ deadline: "2026-11-12", title: "申請" });
		await me.task.create({
			labelIds: [next.id],
			startDate: "2026-11-06",
			title: "まだ早い",
		});

		expect(report).toMatchObject({
			labels: [
				{ id: next.id, name: "next" },
				{ id: pc.id, name: "@PC" },
			],
			note: "",
			priority: 1,
			recurrence: null,
		});
		const titles = async (view: "today" | "inbox" | "upcoming" | "open") =>
			(await me.task.list({ today, view })).map((t) => t.title);
		expect(await titles("today")).toEqual(["レポート", "買い物"]);
		expect(await titles("inbox")).toEqual(["買い物", "申請", "まだ早い"]);
		expect(await titles("upcoming")).toEqual(["レポート", "申請"]);
		expect(
			(await me.task.list({ projectId: school.id, today, view: "open" })).length
		).toBe(1);
		expect(await other.task.list({ today, view: "open" })).toEqual([]);
		await expect(
			me.task.create({ labelIds: ["nope"], title: "x" })
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
		await expect(
			me.task.create({ scheduledDate: "2026-13-01", title: "x" })
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
	});

	it("updates fields, labels and recurrence", async () => {
		const { me, other } = await setup();
		const pc = await me.label.create({ name: "@PC" });
		const created = await me.task.create({ labelIds: [pc.id], title: "a" });

		const updated = await me.task.update({
			estimateMinutes: 30,
			id: created.id,
			labelIds: [],
			note: "メモ",
			recurrence: { basis: "schedule", interval: 1, unit: "week" },
			scheduledDate: today,
			title: "b",
		});

		expect(updated).toMatchObject({
			estimateMinutes: 30,
			labels: [],
			note: "メモ",
			recurrence: { unit: "week" },
			scheduledDate: today,
			title: "b",
		});
		const cleared = await me.task.update({
			id: created.id,
			recurrence: null,
			scheduledDate: null,
		});
		expect(cleared).toMatchObject({ recurrence: null, scheduledDate: null });
		await expect(
			other.task.update({ id: created.id, title: "x" })
		).rejects.toMatchObject({ code: "NOT_FOUND" });
	});

	it("completes and restores a one-off task", async () => {
		const { me } = await setup();
		const created = await me.task.create({ scheduledDate: today, title: "a" });

		const done = await me.task.complete({ id: created.id, today });
		expect(done.recurring).toBe(false);
		expect(done.task.completedAt).toBeInstanceOf(Date);
		expect(await me.task.list({ today, view: "open" })).toEqual([]);
		expect((await me.task.completed({})).map((t) => t.id)).toEqual([
			created.id,
		]);
		await expect(
			me.task.complete({ id: created.id, today })
		).resolves.toMatchObject({ recurring: false });

		const restored = await me.task.uncomplete({ id: created.id });
		expect(restored.completedAt).toBeNull();
		await expect(me.task.uncomplete({ id: created.id })).resolves.toMatchObject(
			{
				completedAt: null,
			}
		);
	});

	it("moves a recurring task forward and can undo it", async () => {
		const { me, sqlite } = await setup();
		const created = await me.task.create({
			deadline: "2026-11-06",
			recurrence: { basis: "schedule", interval: 1, unit: "week" },
			scheduledDate: today,
			title: "週報",
		});

		const done = await me.task.complete({ id: created.id, today });

		expect(done.recurring).toBe(true);
		expect(done.task).toMatchObject({
			completedAt: null,
			deadline: "2026-11-13",
			scheduledDate: "2026-11-12",
		});
		const count = () =>
			(
				sqlite.prepare("select count(*) as n from task_completion").get() as {
					n: number;
				}
			).n;
		expect(count()).toBe(1);

		const undone = await me.task.uncomplete({ id: created.id });
		expect(undone).toMatchObject({
			deadline: "2026-11-06",
			scheduledDate: today,
		});
		expect(count()).toBe(0);
	});

	it("deletes only the owner's tasks", async () => {
		const { me, other } = await setup();
		const created = await me.task.create({ title: "a" });

		await expect(other.task.delete({ id: created.id })).rejects.toMatchObject({
			code: "NOT_FOUND",
		});
		await me.task.delete({ id: created.id });
		expect(await me.task.list({ today, view: "open" })).toEqual([]);
	});
});
