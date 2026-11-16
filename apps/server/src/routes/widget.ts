import { DEFAULT_TIME_ZONE } from "@mine/api/mcp/server";
import { widgetJson, widgetSnapshot } from "@mine/api/rest/widget";
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
 *
 * `/widget/<secret>.json` gives the same snapshot as JSON, for widget makers
 * such as KWGT that draw the widget themselves but cannot send a header.
 */
export const widgetRoutes = new Hono<AppEnv>();

function themeOf(value: string | undefined): WidgetTheme {
	return value === "dark" || value === "light" ? value : "auto";
}

const JSON_SUFFIX = ".json";

const JSON_HEADERS = {
	"Cache-Control": "no-store",
	"Referrer-Policy": "no-referrer",
	"X-Robots-Tag": "noindex",
};

widgetRoutes.get("/widget/:token", async (context) => {
	const param = context.req.param("token");
	const asJson = param.endsWith(JSON_SUFFIX);
	const token = asJson ? param.slice(0, -JSON_SUFFIX.length) : param;
	const theme = themeOf(context.req.query("theme"));
	const caller = await widgetCaller(context.env, token);
	if (!caller) {
		return asJson
			? context.json({ error: "Unknown widget link" }, 404, JSON_HEADERS)
			: context.html(widgetGonePage(theme), 404, WIDGET_HEADERS);
	}
	const snapshot = await widgetSnapshot(caller, Date.now(), DEFAULT_TIME_ZONE);
	return asJson
		? context.json(widgetJson(snapshot), 200, JSON_HEADERS)
		: context.html(widgetPage(snapshot, theme), 200, WIDGET_HEADERS);
});
