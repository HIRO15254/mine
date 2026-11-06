/**
 * Screenshots every screen of the web app with sample data, for comparing the
 * implementation with the Mine UI canvas. It runs the Vite dev server, answers
 * the API from ./fixtures.ts and freezes the clock, so no backend or sign-in is
 * needed and the pictures are the same on every run.
 *
 *   bun run screens                          # every screen, desk + mobile, dark + light
 *   bun run screens -- --only tasks,time --theme dark --viewport mobile
 *
 * Each picture is as tall as the screen's content; --clip keeps it to the
 * viewport instead. Files go to test-results/screens/<screen>.<viewport>.<theme>.png.
 */
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";

import { chromium, type Page } from "playwright";
import { createServer } from "vite";

import { API_ORIGIN, answer } from "./api-mock";
import { NOW, TIME_ZONE } from "./fixtures";
import { SCREENS, THEMES, VIEWPORTS, type Viewport } from "./screens";

const webRoot = path.resolve(import.meta.dirname, "..");
const repoRoot = path.resolve(webRoot, "../..");

const { values } = parseArgs({
	options: {
		clip: { type: "boolean", default: false },
		only: { type: "string" },
		out: {
			type: "string",
			default: path.join(repoRoot, "test-results/screens"),
		},
		scale: { type: "string", default: "1" },
		theme: { type: "string" },
		viewport: { type: "string" },
	},
});

const pick = <T extends { name: string }>(items: T[], filter?: string) => {
	if (!filter) {
		return items;
	}
	const names = new Set(filter.split(","));
	const picked = items.filter((item) => names.has(item.name));
	if (picked.length === 0) {
		throw new Error(`Nothing matches "${filter}"`);
	}
	return picked;
};

const screens = pick(SCREENS, values.only);
const viewports = pick(VIEWPORTS, values.viewport);
const themes = values.theme
	? THEMES.filter((theme) => theme === values.theme)
	: THEMES;
const outDir = path.resolve(values.out);
await mkdir(outDir, { recursive: true });

// Vite gives variables already in the environment priority over .env files.
process.env.VITE_SERVER_URL = API_ORIGIN;
const server = await createServer({
	configFile: path.join(webRoot, "vite.config.ts"),
	logLevel: "warn",
	root: webRoot,
	server: { port: 3099, strictPort: false },
});
await server.listen();
const baseUrl = server.resolvedUrls?.local[0]?.replace(/\/$/, "");
if (!baseUrl) {
	throw new Error("The dev server did not report its address");
}

/** Grows the window until the app's own scrolling panes no longer scroll. */
async function fitContent(page: Page, viewport: Viewport) {
	let height = viewport.height;
	for (let pass = 0; pass < 4; pass++) {
		const overflow = await page.evaluate(() =>
			Math.max(
				0,
				...[...document.querySelectorAll("*")].map(
					(item) => item.scrollHeight - item.clientHeight
				)
			)
		);
		if (overflow <= 1) {
			return;
		}
		height += overflow;
		await page.setViewportSize({ height, width: viewport.width });
	}
}

const browser = await chromium.launch();
const unknown = new Set<string>();
const written: string[] = [];
try {
	for (const viewport of viewports) {
		for (const theme of themes) {
			const mobile = viewport.name === "mobile";
			const context = await browser.newContext({
				colorScheme: theme,
				deviceScaleFactor: Number(values.scale),
				hasTouch: mobile,
				isMobile: mobile,
				locale: "ja-JP",
				timezoneId: TIME_ZONE,
				viewport: { height: viewport.height, width: viewport.width },
			});
			await context.clock.setFixedTime(NOW);
			const state = { signedIn: true };
			await context.route(`${API_ORIGIN}/**`, async (route) => {
				const request = route.request();
				const result = answer(
					new URL(request.url()),
					request.method(),
					request.postData(),
					{
						signedIn: state.signedIn,
						unknown,
					}
				);
				await route.fulfill({
					body: JSON.stringify(result.body),
					contentType: "application/json",
					headers: {
						"access-control-allow-credentials": "true",
						"access-control-allow-origin": baseUrl,
					},
					status: result.status,
				});
			});
			const page = await context.newPage();
			for (const screen of screens) {
				state.signedIn = screen.name !== "login";
				await page.goto(`${baseUrl}${screen.path}`, {
					waitUntil: "networkidle",
				});
				await screen.prepare?.(page);
				await page.evaluate(() => document.fonts.ready);
				await page.waitForTimeout(400);
				const file = path.join(
					outDir,
					`${screen.name}.${viewport.name}.${theme}.png`
				);
				if (!(values.clip || screen.clip)) {
					await fitContent(page, viewport);
				}
				await page.screenshot({ path: file });
				await page.setViewportSize({
					height: viewport.height,
					width: viewport.width,
				});
				written.push(path.relative(process.cwd(), file));
			}
			await context.close();
		}
	}
} finally {
	await browser.close();
	await server.close();
}

console.log(written.join("\n"));
if (unknown.size > 0) {
	console.warn(
		`\nNo fixture for: ${[...unknown].join(", ")}. Add them to apps/web/screens/fixtures.ts.`
	);
}
