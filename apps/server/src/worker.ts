import { trpcServer } from "@hono/trpc-server";
import { createContextFactory } from "@mine/api/context";
import {
	projectChoices,
	startInputSchema,
	startTimer,
	statusOf,
	stopTimer,
	timerStatus,
} from "@mine/api/rest/timer";
import { appRouter } from "@mine/api/routers/index";
import { bearerToken, resolveTokenSession } from "@mine/api/tokens";
import { createAuth } from "@mine/auth";
import { parseAllowedEmails } from "@mine/auth/allowlist";
import { createDb, type Database } from "@mine/db";
import { Hono } from "hono";
import { cors } from "hono/cors";

import type { Bindings } from "./bindings";

function authFor(env: Bindings, db: Database) {
	return createAuth(db, {
		allowedEmails: parseAllowedEmails(env.ALLOWED_EMAILS),
		baseURL: env.BETTER_AUTH_URL,
		corsOrigin: env.CORS_ORIGIN,
		googleClientId: env.GOOGLE_CLIENT_ID,
		googleClientSecret: env.GOOGLE_CLIENT_SECRET,
		secret: env.BETTER_AUTH_SECRET,
	});
}

const app = new Hono<{ Bindings: Bindings }>();

app.use("/*", (context, next) =>
	cors({
		origin: context.env.CORS_ORIGIN,
		allowMethods: ["GET", "POST", "OPTIONS"],
		allowHeaders: ["Content-Type", "Authorization"],
		credentials: true,
	})(context, next)
);

app.on(["GET", "POST"], "/api/auth/*", (context) => {
	const db = createDb(context.env.DB);
	return authFor(context.env, db).handler(context.req.raw);
});

app.use("/trpc/*", (context, next) => {
	const db = createDb(context.env.DB);
	const auth = authFor(context.env, db);
	const headers = context.req.raw.headers;
	return trpcServer({
		router: appRouter,
		createContext: createContextFactory(
			db,
			async () => {
				const token = bearerToken(headers.get("Authorization"));
				if (token) {
					return resolveTokenSession(db, token);
				}
				const session = await auth.api.getSession({ headers });
				return session ? { user: session.user } : null;
			},
			{
				getGoogleAccessToken: async () => {
					try {
						const token = await auth.api.getAccessToken({
							body: { providerId: "google" },
							headers,
						});
						return token.accessToken ?? null;
					} catch {
						return null;
					}
				},
			}
		),
	})(context, next);
});

/**
 * JSON API for third-party apps. Only personal API tokens are accepted here,
 * so a browser cookie can never trigger these from another site.
 */
type Caller = ReturnType<typeof appRouter.createCaller>;
const v1 = new Hono<{ Bindings: Bindings; Variables: { caller: Caller } }>();

async function tokenCaller(
	env: Bindings,
	header: string | undefined
): Promise<Caller | null> {
	const token = bearerToken(header);
	if (!token) {
		return null;
	}
	const db = createDb(env.DB);
	const session = await resolveTokenSession(db, token);
	if (!session) {
		return null;
	}
	return appRouter.createCaller(
		await createContextFactory(db, () => Promise.resolve(session))()
	);
}

async function readJson(request: Request): Promise<unknown> {
	const text = await request.text();
	return text.trim() ? JSON.parse(text) : {};
}

v1.use("/*", async (context, next) => {
	const caller = await tokenCaller(
		context.env,
		context.req.header("Authorization")
	);
	if (!caller) {
		return context.json({ error: "API token required" }, 401);
	}
	context.set("caller", caller);
	await next();
});

v1.onError((error, context) => {
	const status = error instanceof SyntaxError ? 400 : statusOf(error);
	return context.json(
		{ error: status === 500 ? "Internal error" : error.message },
		status as 400
	);
});

v1.get("/timer", async (context) =>
	context.json(await timerStatus(context.get("caller"), Date.now()))
);

v1.post("/timer/start", async (context) => {
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

v1.post("/timer/stop", async (context) =>
	context.json(await stopTimer(context.get("caller")))
);

v1.get("/projects", async (context) =>
	context.json(await projectChoices(context.get("caller")))
);

app.route("/v1", v1);

app.get("/", (context) => context.text("OK"));

export { app };
export default app;
