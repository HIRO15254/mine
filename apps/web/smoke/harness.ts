/**
 * The web app in a real browser against the real API: Vite serves the app,
 * and every request to the API is answered in this process by the tRPC
 * routers on an in-memory database (`createTestApp`). Only sign-in and
 * Google are faked. The clock stands at `NOW` in the browser and the server.
 */
import path from "node:path";

import { appRouter } from "@mine/api/routers/index";
import { createTestApp, type TestApp } from "@mine/api/testing";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { type Browser, chromium, type Page } from "playwright";
import { createServer, type ViteDevServer } from "vite";

import { VIEWPORTS } from "../screens/screens";

/** 2026-11-10 (Tue) 14:20 in Tokyo, as in the component tests. */
export const NOW = Date.parse("2026-11-10T14:20:00+09:00");
export const TODAY = "2026-11-10";

const API_ORIGIN = "http://api.smoke.test";
const TIME_ZONE = "Asia/Tokyo";
const webRoot = path.resolve(import.meta.dirname, "..");
const TRAILING_SLASH = /\/$/;

let server: ViteDevServer | undefined;
let browser: Browser | undefined;
let baseUrl = "";

export async function startSmoke() {
	// Vite gives variables already in the environment priority over .env files.
	process.env.VITE_SERVER_URL = API_ORIGIN;
	server = await createServer({
		configFile: path.join(webRoot, "vite.config.ts"),
		logLevel: "warn",
		root: webRoot,
		server: { port: 3098, strictPort: false },
	});
	await server.listen();
	baseUrl = server.resolvedUrls?.local[0]?.replace(TRAILING_SLASH, "") ?? "";
	if (!baseUrl) {
		throw new Error("The dev server did not report its address");
	}
	browser = await chromium.launch();
}

export async function stopSmoke() {
	await browser?.close();
	await server?.close();
}

/** Google with one calendar and nothing in it. */
const google = (input: RequestInfo | URL) =>
	Promise.resolve(
		Response.json(
			String(input).includes("/calendarList")
				? { items: [{ id: "primary", primary: true, summary: "予定" }] }
				: { items: [] }
		)
	);

export interface Session {
	app: TestApp;
	close: () => Promise<void>;
	/** Opens an address of the app and waits until the screen has settled. */
	open: (address: string) => Promise<void>;
	page: Page;
	/** Whether the API answers the session lookup as signed in. */
	signedIn: boolean;
}

/** A fresh database and a fresh browser profile on the desk layout. */
export async function newSession(): Promise<Session> {
	if (!browser) {
		throw new Error("Call startSmoke() first");
	}
	const app = await createTestApp({
		fetch: google,
		getGoogleAccessToken: () => Promise.resolve("token"),
		now: NOW,
	});
	const desk = VIEWPORTS.find((viewport) => viewport.name === "desk");
	const context = await browser.newContext({
		locale: "ja-JP",
		timezoneId: TIME_ZONE,
		viewport: { height: desk?.height ?? 860, width: desk?.width ?? 1280 },
	});
	await context.clock.setFixedTime(NOW);
	const cors = {
		"access-control-allow-credentials": "true",
		"access-control-allow-headers": "content-type",
		"access-control-allow-methods": "GET, POST",
		"access-control-allow-origin": baseUrl,
	};
	const session: Session = {
		app,
		close: () => context.close(),
		open: async (address) => {
			await session.page.goto(`${baseUrl}${address}`, {
				waitUntil: "networkidle",
			});
			await session.page.waitForSelector("#splash", { state: "detached" });
		},
		page: await context.newPage(),
		signedIn: true,
	};
	await context.route(`${API_ORIGIN}/**`, async (route) => {
		const request = route.request();
		const url = new URL(request.url());
		if (request.method() === "OPTIONS") {
			await route.fulfill({ headers: cors, status: 204 });
			return;
		}
		if (url.pathname === "/api/auth/get-session") {
			await route.fulfill({
				body: JSON.stringify(
					session.signedIn
						? {
								session: {
									expiresAt: new Date(NOW + 86_400_000).toISOString(),
									id: "s1",
									token: "smoke",
									userId: app.user.id,
								},
								user: app.user,
							}
						: null
				),
				contentType: "application/json",
				headers: cors,
			});
			return;
		}
		const response = await fetchRequestHandler({
			createContext: app.contextFor(
				session.signedIn ? { user: app.user } : null
			),
			endpoint: "/trpc",
			req: new Request(request.url(), {
				body: request.postData() ?? undefined,
				headers: await request.allHeaders(),
				method: request.method(),
			}),
			router: appRouter,
		});
		await route.fulfill({
			body: await response.text(),
			contentType: "application/json",
			headers: cors,
			status: response.status,
		});
	});
	return session;
}
