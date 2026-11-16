import { DEFAULT_TIME_ZONE } from "@mine/api/mcp/server";
import { widgetSnapshot } from "@mine/api/rest/widget";
import { Hono } from "hono";

import type { AppEnv } from "../http";
import { widgetCaller } from "../session";
import {
	WIDGET_HEADERS,
	type WidgetTheme,
	widgetGonePage,
	widgetPage,
} from "../widget-page";

/**
 * `/widget/<secret>`: a page for Android apps that show a web page as a
 * home-screen widget. They cannot sign in, so the secret in the address is
 * the sign-in; it is issued in the web app's settings and reads only this
 * page. Like the MCP server, the day is the one in `Asia/Tokyo`.
 */
export const widgetRoutes = new Hono<AppEnv>();

function themeOf(value: string | undefined): WidgetTheme {
	return value === "dark" || value === "light" ? value : "auto";
}

widgetRoutes.get("/widget/:token", async (context) => {
	const theme = themeOf(context.req.query("theme"));
	const caller = await widgetCaller(context.env, context.req.param("token"));
	if (!caller) {
		return context.html(widgetGonePage(theme), 404, WIDGET_HEADERS);
	}
	const snapshot = await widgetSnapshot(caller, Date.now(), DEFAULT_TIME_ZONE);
	return context.html(widgetPage(snapshot, theme), 200, WIDGET_HEADERS);
});
