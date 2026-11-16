import { describe, expect, it } from "vitest";

import { WIDGET_TASK_LIMIT, widgetSnapshot } from "../rest/widget";
import { createTestApp, OTHER_USER, TEST_USER } from "../testing";
import { resolveTokenSession, resolveWidgetToken } from "../tokens";

const TZ = "Asia/Tokyo";
/** 2026-11-16 10:30 in Tokyo. */
const NOW = Date.parse("2026-11-16T10:30:00+09:00");

function googleFetch(items: unknown[]) {
	return (input: RequestInfo | URL) => {
		const url = new URL(String(input));
		if (url.pathname.endsWith("/users/me/calendarList")) {
			return Promise.resolve(
				Response.json({
					items: [
						{
							accessRole: "owner",
							backgroundColor: "#9fe1e7",
							id: "me@example.com",
							primary: true,
							selected: true,
							summary: "me",
						},
					],
				})
			);
		}
		return Promise.resolve(Response.json({ items }));
	};
}

describe("widget link", () => {
	it("issues, replaces and revokes the one link a user has", async () => {
		const app = await createTestApp({ now: NOW });
		await expect(app.caller.widget.link()).resolves.toBeNull();

		const first = await app.caller.widget.issue();
		expect(first.token.startsWith("mine_wg_")).toBe(true);
		await expect(app.caller.widget.link()).resolves.toMatchObject({
			lastUsedAt: null,
			prefix: first.prefix,
		});
		await expect(resolveWidgetToken(app.db, first.token)).resolves.toEqual({
			user: TEST_USER,
			via: "widget",
		});
		await expect(app.caller.widget.link()).resolves.toMatchObject({
			lastUsedAt: expect.any(Number),
		});

		const second = await app.caller.widget.issue();
		await expect(resolveWidgetToken(app.db, first.token)).resolves.toBeNull();
		await expect(resolveWidgetToken(app.db, second.token)).resolves.toEqual({
			user: TEST_USER,
			via: "widget",
		});

		await expect(app.caller.widget.revoke()).resolves.toEqual({
			revoked: true,
		});
		await expect(resolveWidgetToken(app.db, second.token)).resolves.toBeNull();
		await expect(app.caller.widget.link()).resolves.toBeNull();
	});

	it("is never accepted as a bearer token, nor anything else as a link", async () => {
		const app = await createTestApp();
		const { token } = await app.caller.widget.issue();
		await expect(resolveTokenSession(app.db, token)).resolves.toBeNull();

		const api = await app.caller.token.create({ name: "shortcut" });
		await expect(resolveWidgetToken(app.db, api.token)).resolves.toBeNull();
	});

	it("keeps each user's link apart and away from tokens", async () => {
		const app = await createTestApp();
		const other = await app.callerFor(OTHER_USER);
		await app.caller.widget.issue();
		await expect(other.widget.link()).resolves.toBeNull();
		await expect(other.widget.revoke()).resolves.toEqual({ revoked: false });
		await expect(app.caller.widget.link()).resolves.not.toBeNull();

		for (const via of ["api-token", "oauth", "widget"] as const) {
			const caller = await app.callerFor(TEST_USER, via);
			await expect(caller.widget.issue()).rejects.toMatchObject({
				code: "FORBIDDEN",
			});
		}
	});
});

describe("widget snapshot", () => {
	it("shows the timer, the rest of today's events and Today's tasks", async () => {
		const app = await createTestApp({
			fetch: googleFetch([
				{
					end: { dateTime: "2026-11-16T09:00:00+09:00" },
					id: "done",
					start: { dateTime: "2026-11-16T08:00:00+09:00" },
					summary: "朝会",
				},
				{
					end: { dateTime: "2026-11-16T15:00:00+09:00" },
					id: "later",
					start: { dateTime: "2026-11-16T14:00:00+09:00" },
					summary: "面談",
				},
				{
					colorId: "11",
					end: { dateTime: "2026-11-16T11:00:00+09:00" },
					id: "now",
					start: { dateTime: "2026-11-16T10:00:00+09:00" },
					summary: "<打ち合わせ>",
				},
				{
					end: { date: "2026-11-17" },
					id: "allday",
					start: { date: "2026-11-16" },
					summary: "出張",
				},
			]),
			getGoogleAccessToken: () => Promise.resolve("token"),
			now: NOW,
		});
		const { caller } = app;
		const work = await caller.project.create({
			color: "chart-2",
			name: "仕事",
		});
		const next = await caller.label.create({ name: "next" });
		await caller.task.create({ labelIds: [next.id], title: "メールを返す" });
		await caller.task.create({
			priority: 1,
			projectId: work.id,
			scheduledDate: "2026-11-16",
			scheduledTime: "13:00",
			title: "資料を送る",
		});
		await caller.task.create({ deadline: "2026-11-14", title: "請求書" });
		await caller.task.create({ scheduledDate: "2026-11-20", title: "来週" });
		app.clock.now = NOW - 65 * 60_000;
		await caller.time.start({ description: "設計", projectId: work.id });
		app.clock.now = NOW;

		const snapshot = await widgetSnapshot(
			await app.callerFor(TEST_USER, "widget"),
			NOW,
			TZ
		);

		expect(snapshot).toMatchObject({
			moreTasks: 0,
			now: "10:30",
			timer: {
				description: "設計",
				elapsed: "1:05",
				project: "仕事",
				projectColor: "chart-2",
				startedAt: "09:25",
			},
			today: "2026-11-16",
		});
		expect(snapshot.events).toEqual([
			expect.objectContaining({ allDay: true, title: "出張" }),
			expect.objectContaining({
				current: true,
				end: "11:00",
				start: "10:00",
				title: "<打ち合わせ>",
			}),
			expect.objectContaining({
				current: false,
				end: "15:00",
				start: "14:00",
				title: "面談",
			}),
		]);
		expect(snapshot.tasks).toEqual([
			{
				overdue: false,
				priority: 1,
				project: "仕事",
				projectColor: "chart-2",
				time: "13:00",
				title: "資料を送る",
			},
			expect.objectContaining({ overdue: true, title: "請求書" }),
			expect.objectContaining({ overdue: false, title: "メールを返す" }),
		]);
	});

	it("counts the tasks it leaves out and survives a calendar it cannot read", async () => {
		const app = await createTestApp({ now: NOW });
		const next = await app.caller.label.create({ name: "next" });
		for (let index = 0; index < WIDGET_TASK_LIMIT + 3; index += 1) {
			await app.caller.task.create({
				labelIds: [next.id],
				title: `タスク${index}`,
			});
		}

		const snapshot = await widgetSnapshot(app.caller, NOW, TZ);

		expect(snapshot.events).toBeNull();
		expect(snapshot.timer).toBeNull();
		expect(snapshot.tasks).toHaveLength(WIDGET_TASK_LIMIT);
		expect(snapshot.moreTasks).toBe(3);
	});
});
