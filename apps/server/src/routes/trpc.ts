import { trpcServer } from "@hono/trpc-server";
import { appRouter } from "@mine/api/routers/index";
import { bearerToken } from "@mine/api/tokens";
import { Hono } from "hono";

import type { AppEnv } from "../http";
import { requestContext } from "../session";

/**
 * `/trpc`: the web app. It signs in with its cookie. A personal API token
 * works here too; an OAuth token does not, because its consent screen only
 * promised the MCP tools.
 */
export const trpcRoutes = new Hono<AppEnv>();

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/*
 * The session cookie is SameSite=None, so another site's form could send a
 * write with it (a form post needs no CORS preflight). A write that relies on
 * the cookie must therefore come from the web app's own origin.
 */
trpcRoutes.use("/trpc/*", async (context, next) => {
	const byToken = bearerToken(context.req.header("Authorization")) !== null;
	const fromWebApp = context.req.header("Origin") === context.env.CORS_ORIGIN;
	if (!(SAFE_METHODS.has(context.req.method) || byToken || fromWebApp)) {
		return context.json({ error: "Cross-site request refused" }, 403);
	}
	await next();
});

trpcRoutes.use("/trpc/*", (context, next) =>
	trpcServer({
		createContext: requestContext(context.env, context.req.raw.headers, [
			"cookie",
			"api-token",
		]).createContext,
		router: appRouter,
	})(context, next)
);
