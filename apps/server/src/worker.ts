import { createDb } from "@mine/db";
import { Hono } from "hono";
import { cors } from "hono/cors";

import type { AppEnv } from "./http";
import { mcpRoutes } from "./routes/mcp";
import { oauthRoutes } from "./routes/oauth";
import { trpcRoutes } from "./routes/trpc";
import { v1Routes } from "./routes/v1";
import { authFor } from "./session";

/*
 * The Worker: CORS, Better Auth's own endpoints, and the three API surfaces.
 * Who may call what is decided in `session.ts`; each file in `routes/` names
 * the kinds of sign-in its surface accepts.
 */
const app = new Hono<AppEnv>();

app.use("/*", (context, next) =>
	cors({
		origin: context.env.CORS_ORIGIN,
		allowMethods: ["GET", "POST", "OPTIONS"],
		allowHeaders: ["Content-Type", "Authorization"],
		credentials: true,
	})(context, next)
);

app.on(["GET", "POST"], "/api/auth/*", (context) =>
	authFor(context.env, createDb(context.env.DB)).handler(context.req.raw)
);

app.route("/", trpcRoutes);
app.route("/v1", v1Routes);
app.route("/", oauthRoutes);
app.route("/", mcpRoutes);

app.get("/", (context) => context.text("OK"));

// Connector lists that look up the API host's favicon get the Mine mark.
app.get("/favicon.ico", (context) =>
	context.redirect(`${context.env.CORS_ORIGIN}/favicon.ico`, 301)
);

export { app };
export default app;
