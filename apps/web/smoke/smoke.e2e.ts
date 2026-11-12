/**
 * The few paths that must work in a real browser for Mine to be usable:
 * signing in is asked for, a task can be added, completed and brought back,
 * the timer starts and stops, and a task and an event can be dragged on the
 * calendar.
 * Each test checks what the server holds afterwards, not only the screen.
 *
 *   bun run smoke
 */
import { afterAll, afterEach, beforeAll, beforeEach, expect, it } from "vitest";

import {
	googleWrites,
	newSession,
	type Session,
	startSmoke,
	stopSmoke,
	TODAY,
} from "./harness";

const TOMORROW = "2026-11-11";
const DAY_AFTER = "2026-11-12";
const EVENT_TITLE = /打ち合わせ/;
const HOUR_AND_MINUTE = /^\d{2}:\d{2}$/;
/** A height inside the 860px window, below the page and grid headers. */
const DROP_Y = 500;

let session: Session;

beforeAll(startSmoke);
afterAll(stopSmoke);
beforeEach(async () => {
	session = await newSession();
});
afterEach(() => session.close());

const openTasks = () =>
	session.app.caller.task.list({ today: TODAY, view: "open" });

it("asks a signed-out visitor to sign in", async () => {
	session.signedIn = false;

	await session.open("/tasks");

	await session.page
		.getByRole("button", { name: "Google でログイン" })
		.waitFor();
	expect(new URL(session.page.url()).pathname).toBe("/login");
});

it("adds a task from the quick-add box", async () => {
	const { page } = session;
	await session.open("/tasks?view=today");

	await page.getByPlaceholder("タスクを追加").fill("牛乳を買う 今日 p2");
	await page.keyboard.press("Enter");

	await page.getByText("牛乳を買う").waitFor();
	await expect
		.poll(openTasks)
		.toMatchObject([
			{ priority: 2, scheduledDate: TODAY, title: "牛乳を買う" },
		]);
});

it("completes a task and brings it back with the undo", async () => {
	const { app, page } = session;
	await app.caller.task.create({
		scheduledDate: TODAY,
		title: "レポートを出す",
	});
	await session.open("/tasks?view=today");

	await page
		.getByRole("button", { name: "「レポートを出す」を完了にする" })
		.click();

	await page.getByText("完了にしました").waitFor();
	await expect.poll(openTasks).toEqual([]);

	await page.getByRole("button", { name: "元に戻す" }).click();

	await expect.poll(openTasks).toMatchObject([{ title: "レポートを出す" }]);
	await page
		.getByRole("button", { name: "「レポートを出す」を完了にする" })
		.waitFor();
});

it("starts and stops the timer", async () => {
	const { app, page } = session;
	await app.caller.project.create({ name: "仕事" });
	await session.open("/time");

	await page.getByLabel("何をしていますか").fill("資料作り #仕事 ");
	await page.getByRole("button", { name: "計測を始める" }).click();

	await page.getByRole("button", { name: "計測を止める" }).waitFor();
	await expect
		.poll(() => app.caller.time.current())
		.toMatchObject({ description: "資料作り", endedAt: null });

	await page.getByRole("button", { name: "計測を止める" }).click();

	await page.getByRole("button", { name: "計測を始める" }).waitFor();
	await expect.poll(() => app.caller.time.current()).toBeNull();
});

it("plans a task by dragging it onto the calendar", async () => {
	const { app, page } = session;
	const task = await app.caller.task.create({ title: "スライドを作る" });
	await session.open("/calendar");
	// The tray starts on today's tasks; this one has no day yet.
	await page.getByLabel("表示するタスク").getByText("すべて").click();

	const chip = page
		.locator('[data-slot="task-tray"]')
		.getByText("スライドを作る");
	await chip.waitFor();
	const card = await chip.boundingBox();
	const column = await page
		.locator(`[data-day-column="${TOMORROW}"]`)
		.boundingBox();
	if (!(card && column)) {
		throw new Error("The tray or tomorrow's column is not on the screen");
	}
	const from = { x: card.x + card.width / 2, y: card.y + card.height / 2 };
	// The grid has scrolled to the current hour, so aim inside the window.
	const to = { x: column.x + column.width / 2, y: DROP_Y };
	expect(column.y).toBeLessThan(DROP_Y);
	expect(column.y + column.height).toBeGreaterThan(DROP_Y);
	await page.mouse.move(from.x, from.y);
	await page.mouse.down();
	// In steps: the drag starts only after the pointer has travelled a little.
	await page.mouse.move(from.x + 12, from.y + 12, { steps: 4 });
	await page.mouse.move(to.x, to.y, { steps: 12 });
	// The outline of where it will land shows that the grid took the drag.
	await page.locator('[data-slot="drop-preview"]').waitFor();
	await page.mouse.up();

	await expect
		.poll(async () => (await openTasks()).find((item) => item.id === task.id))
		.toMatchObject({
			scheduledDate: TOMORROW,
			scheduledTime: expect.stringMatching(HOUR_AND_MINUTE),
		});
});

it("moves an event by dragging it to another day and time", async () => {
	const { page } = session;
	googleWrites.length = 0;
	await session.open("/calendar");

	const block = page
		.locator(`[data-day-column="${TOMORROW}"]`)
		.getByRole("button", { name: EVENT_TITLE });
	await block.waitFor();
	const from = await block.boundingBox();
	const column = await page
		.locator(`[data-day-column="${DAY_AFTER}"]`)
		.boundingBox();
	if (!(from && column)) {
		throw new Error("The event or the day after tomorrow is not on the screen");
	}
	const grab = { x: from.x + from.width / 2, y: from.y + 6 };
	await page.mouse.move(grab.x, grab.y);
	await page.mouse.down();
	await page.mouse.move(grab.x + 12, grab.y + 12, { steps: 4 });
	await page.mouse.move(column.x + column.width / 2, DROP_Y, { steps: 12 });
	await page.locator('[data-slot="drop-preview"]').waitFor();
	await page.mouse.up();

	await expect.poll(() => googleWrites.length).toBe(1);
	const [write] = googleWrites;
	expect(write?.method).toBe("PATCH");
	expect(write?.url).toContain("/calendars/primary/events/meeting");
	const start = (write?.body.start as { dateTime: string }).dateTime;
	const end = (write?.body.end as { dateTime: string }).dateTime;
	// On the day after tomorrow, still an hour long.
	expect(
		new Date(start).toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" })
	).toBe(DAY_AFTER);
	expect(Date.parse(end) - Date.parse(start)).toBe(60 * 60_000);
});

it("fits the whole day on the screen at the smallest scale, with nothing else scrolling", async () => {
	const { page } = session;
	await session.open("/calendar");
	const zoomOut = page.getByRole("button", { name: "時間の縮尺を縮小" });
	while (await zoomOut.isEnabled()) {
		await zoomOut.click();
	}

	// Anything taller than its box that could scroll: the page, its shell, the grid.
	const scrollable = await page.evaluate(() =>
		[document.scrollingElement, ...document.querySelectorAll("*")]
			.filter((element): element is Element => element !== null)
			.filter((element) => {
				const { overflowY } = getComputedStyle(element);
				const scrolls =
					element === document.scrollingElement ||
					overflowY === "auto" ||
					overflowY === "scroll";
				return scrolls && element.scrollHeight > element.clientHeight + 1;
			})
			.map((element) => element.getAttribute("data-slot") ?? element.tagName)
	);
	expect(scrollable).toEqual([]);
	// And the last hour ends at the bottom of the grid.
	const grid = await page.locator('[data-slot="time-grid"]').boundingBox();
	const hours = await page
		.locator('[data-slot="time-grid-hours"]')
		.boundingBox();
	expect(
		hours && grid && grid.y + grid.height - (hours.y + hours.height)
	).toBeLessThan(2);
});
