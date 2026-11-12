import { TRPCError } from "@trpc/server";
import { describe, expect, it } from "vitest";

import { formatDuration } from "../format";
import { resolveProject } from "../projects/resolve";
import { projectChoices, statusOf } from "../rest/v1";
import { createTestApp, TEST_USER } from "../testing";
import { startTimer, stopTimer, timerStatus } from "../time/timer";

const MINUTE = 60_000;
const START = Date.UTC(2026, 10, 6, 0);

async function setup() {
	const app = await createTestApp({ now: START });
	const { clock } = app;
	const caller = await app.callerFor(TEST_USER, "api-token");
	const uni = await caller.project.create({ name: "大学" });
	const lab = await caller.project.create({ name: "研究", parentId: uni.id });
	const old = await caller.project.create({ name: "旧" });
	await caller.project.update({ archived: true, id: old.id });
	return { caller, clock, lab, uni };
}

describe("REST timer", () => {
	it("starts by project path, reports status and stops", async () => {
		const { caller, clock, lab } = await setup();

		await expect(timerStatus(caller, START)).resolves.toMatchObject({
			running: false,
			text: "計測していません",
		});

		const started = await startTimer(
			caller,
			{ description: "論文", project: "大学/研究" },
			START + 5 * MINUTE
		);
		expect(started).toEqual({
			description: "論文",
			elapsed: "0:05",
			elapsedMinutes: 5,
			project: "大学 / 研究",
			running: true,
			startedAt: new Date(START).toISOString(),
			text: "0:05 論文（大学 / 研究）",
		});
		expect((await caller.time.current())?.projectId).toBe(lab.id);

		clock.now = START + 65 * MINUTE;
		await expect(stopTimer(caller)).resolves.toEqual({
			durationMinutes: 65,
			stopped: true,
			text: "停止しました 1:05 論文",
		});
		await expect(stopTimer(caller)).resolves.toEqual({
			stopped: false,
			text: "計測していません",
		});

		await startTimer(caller, {}, START);
		await expect(timerStatus(caller, START)).resolves.toMatchObject({
			project: null,
			text: "0:00 説明なし",
		});
	});

	it("asks for the full path when a name fits several projects", async () => {
		const { caller, lab } = await setup();
		const club = await caller.project.create({ name: "サークル" });
		await caller.project.create({ name: "研究", parentId: club.id });
		const projects = await caller.project.list();

		expect(() => resolveProject(projects, "研究")).toThrow(
			'"研究" matches several projects: 大学 / 研究, サークル / 研究. Use the full path.'
		);
		expect(resolveProject(projects, "大学 / 研究").id).toBe(lab.id);
		await expect(
			startTimer(caller, { project: "研究" }, START)
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
		await expect(caller.time.current()).resolves.toBeNull();
	});

	it("matches projects by name and rejects unknown ones", async () => {
		const { caller, uni } = await setup();
		const projects = await caller.project.list();

		expect(resolveProject(projects, " 研究 ").name).toBe("研究");
		expect(resolveProject(projects, "大学").id).toBe(uni.id);
		expect(() => resolveProject(projects, "旧")).toThrow(
			'Unknown project "旧". Projects: 大学, 大学 / 研究'
		);
		await expect(
			startTimer(caller, { project: "どこか" }, START)
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
		await expect(projectChoices(caller)).resolves.toEqual([
			{ id: uni.id, name: "大学", path: "大学" },
			expect.objectContaining({ name: "研究", path: "大学 / 研究" }),
		]);
	});

	it("maps errors to HTTP statuses", () => {
		expect(formatDuration(-1)).toBe("0:00");
		expect(statusOf(new TRPCError({ code: "BAD_REQUEST" }))).toBe(400);
		expect(statusOf(new TRPCError({ code: "NOT_FOUND" }))).toBe(404);
		expect(statusOf(new TRPCError({ code: "CONFLICT" }))).toBe(500);
		expect(statusOf(new Error("x"))).toBe(500);
	});
});
