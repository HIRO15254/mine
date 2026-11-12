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
	{ name: "settings", path: "/settings" },
	{ name: "login", path: "/login" },
];
