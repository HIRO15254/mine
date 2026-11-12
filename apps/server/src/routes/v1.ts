import {
	projectChoices,
	startInputSchema,
	startTimer,
	statusOf,
	stopTimer,
	timerStatus,
} from "@mine/api/rest/timer";
import { Hono } from "hono";

import type { Bindings } from "../bindings";
import { readJson } from "../http";
import { type Caller, resolveCaller } from "../session";

/**
 * `/v1`: JSON API for shortcuts and other apps. Only personal API tokens are
 * accepted here: a browser cookie can never trigger these from another site,
 * and an OAuth token stays within the MCP tools its consent screen described.
 */
export const v1Routes = new Hono<{
	Bindings: Bindings;
	Variables: { caller: Caller };
}>();

v1Routes.use("/*", async (context, next) => {
	const caller = await resolveCaller(context.env, context.req.raw.headers, [
		"api-token",
	]);
	if (!caller) {
		return context.json({ error: "API token required" }, 401);
	}
	context.set("caller", caller);
	await next();
});

v1Routes.onError((error, context) => {
	const status = error instanceof SyntaxError ? 400 : statusOf(error);
	return context.json(
		{ error: status === 500 ? "Internal error" : error.message },
		status as 400
	);
});

v1Routes.get("/timer", async (context) =>
	context.json(await timerStatus(context.get("caller"), Date.now()))
);

v1Routes.post("/timer/start", async (context) => {
	const body = await readJson(context.req.raw);
	const query = context.req.query();
	const input = startInputSchema.safeParse({
		...query,
		...(typeof body === "object" && body ? body : {}),
	});
	if (!input.success) {
		return context.json({ error: "Invalid input" }, 400);
	}
	return context.json(
		await startTimer(context.get("caller"), input.data, Date.now())
	);
});

v1Routes.post("/timer/stop", async (context) =>
	context.json(await stopTimer(context.get("caller")))
);

v1Routes.get("/projects", async (context) =>
	context.json(await projectChoices(context.get("caller")))
);
