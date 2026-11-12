import type { Page } from "playwright";

export interface Viewport {
	height: number;
	name: string;
	width: number;
}

/** Desk is the sidebar layout above the 720px `desk` breakpoint; mobile is a phone. */
export const VIEWPORTS: Viewport[] = [
	{ height: 860, name: "desk", width: 1280 },
	{ height: 844, name: "mobile", width: 390 },
];

export const THEMES = ["dark", "light"] as const;
export type Theme = (typeof THEMES)[number];

export interface Screen {
	/** Keep the picture to the viewport, for overlays such as sheets and dialogs. */
	clip?: boolean;
	/** The file name stem, and the name used with --only. */
	name: string;
	path: string;
	/** Brings the page into the state to capture, after it has loaded. */
	prepare?: (page: Page) => Promise<void>;
}

/**
 * Every screen worth comparing with the design. Add a row when a route or a
 * state that has its own artboard on the canvas is added.
 */
export const SCREENS: Screen[] = [
	{ name: "today", path: "/" },
	{ name: "tasks", path: "/tasks?view=today" },
	{
		clip: true,
		name: "task-editor",
		path: "/tasks?view=today",
		prepare: async (page) => {
			await page.getByText("ゼミ発表のスライドを仕上げる").first().click();
		},
	},
	{ name: "time", path: "/time" },
	{ name: "calendar", path: "/calendar" },
	{ name: "calendar-month", path: "/calendar?view=month" },
	{
		name: "calendar-time-rail",
		path: "/calendar",
		prepare: async (page) => {
			await page.locator('[data-slot="time-rail"] button').first().click();
		},
	},
	{
		// Zoomed in and scrolled: the day rows stay put and the rail passes under them.
		clip: true,
		name: "calendar-scrolled",
		path: "/calendar",
		prepare: async (page) => {
			await page.getByRole("button", { name: "時間の縮尺を拡大" }).click();
			await page.locator('[data-slot="time-grid-hours"]').evaluate((hours) => {
				// The hours scroll inside the grid; move them past the rail.
				if (hours.parentElement) {
					hours.parentElement.scrollTop = 9.5 * 72;
				}
			});
		},
	},
	{
		// Zoomed out as far as it goes: the whole day fills the screen.
		clip: true,
		name: "calendar-fit",
		path: "/calendar",
		prepare: async (page) => {
			const zoomOut = page.getByRole("button", { name: "時間の縮尺を縮小" });
			while (await zoomOut.isEnabled()) {
				await zoomOut.click();
			}
		},
	},
	{
		clip: true,
		name: "event-editor",
		path: "/calendar",
		prepare: async (page) => {
			await page.getByText("研究室ミーティング").first().click();
		},
	},
	{ name: "settings", path: "/settings" },
	{ name: "login", path: "/login" },
];
