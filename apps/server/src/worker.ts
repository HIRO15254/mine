import { trpcServer } from "@hono/trpc-server";
import {
	type Context,
	createContextFactory,
	type Session,
} from "@mine/api/context";
import { DEFAULT_TIME_ZONE, handleMcp } from "@mine/api/mcp/server";
import {
	authorizationServerMetadata,
	exchangeToken,
	OAuthError,
	protectedResourceMetadata,
	registerClient,
} from "@mine/api/oauth";
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
import { Hono, type Context as HonoContext } from "hono";
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

type Auth = ReturnType<typeof authFor>;

/**
 * A browser session reads Google tokens through its cookie; a token session
 * (API token or OAuth app) looks them up by user, since it has no cookie.
 */
function googleTokenResolver(
	auth: Auth,
	headers: Headers,
	session: () => Session | null
) {
	return async () => {
		const current = session();
		try {
			const token =
				current?.via === "token"
					? await auth.api.getAccessToken({
							body: { providerId: "google", userId: current.user.id },
						})
					: await auth.api.getAccessToken({
							body: { providerId: "google" },
							headers,
						});
			return token.accessToken ?? null;
		} catch {
			return null;
		}
	};
}

app.use("/trpc/*", (context, next) => {
	const db = createDb(context.env.DB);
	const auth = authFor(context.env, db);
	const headers = context.req.raw.headers;
	let resolved: Session | null = null;
	return trpcServer({
		router: appRouter,
		createContext: createContextFactory(
			db,
			async () => {
				const token = bearerToken(headers.get("Authorization"));
				if (token) {
					resolved = await resolveTokenSession(db, token);
					return resolved;
				}
				const session = await auth.api.getSession({ headers });
				resolved = session ? { user: session.user } : null;
				return resolved;
			},
			{
				getGoogleAccessToken: googleTokenResolver(
					auth,
					headers,
					() => resolved
				),
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

async function tokenContext(
	env: Bindings,
	header: string | undefined
): Promise<Context | null> {
	const token = bearerToken(header);
	if (!token) {
		return null;
	}
	const db = createDb(env.DB);
	const session = await resolveTokenSession(db, token);
	if (!session) {
		return null;
	}
	const auth = authFor(env, db);
	return createContextFactory(db, () => Promise.resolve(session), {
		getGoogleAccessToken: googleTokenResolver(
			auth,
			new Headers(),
			() => session
		),
	})();
}

async function tokenCaller(
	env: Bindings,
	header: string | undefined
): Promise<Caller | null> {
	const ctx = await tokenContext(env, header);
	return ctx ? appRouter.createCaller(ctx) : null;
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

/*
 * MCP for Claude. Claude signs in through OAuth (dynamic registration, PKCE
 * and a consent screen in the web app); Claude Code can also send a
 * personal API token as a bearer header.
 */
const origin = (context: HonoContext) => new URL(context.req.url).origin;

app.get("/.well-known/oauth-authorization-server", (context) =>
	context.json(
		authorizationServerMetadata(origin(context), context.env.CORS_ORIGIN)
	)
);

app.get("/.well-known/oauth-protected-resource/*", (context) =>
	context.json(
		protectedResourceMetadata(`${origin(context)}/mcp`, origin(context))
	)
);
app.get("/.well-known/oauth-protected-resource", (context) =>
	context.json(
		protectedResourceMetadata(`${origin(context)}/mcp`, origin(context))
	)
);

function oauthFailure(context: HonoContext, error: unknown) {
	if (error instanceof OAuthError) {
		return context.json(error.toJSON(), error.status);
	}
	if (error instanceof SyntaxError) {
		return context.json(
			{ error: "invalid_request", error_description: "Invalid body" },
			400
		);
	}
	throw error;
}

app.post("/oauth/register", async (context) => {
	try {
		const client = await registerClient(
			createDb(context.env.DB),
			await readJson(context.req.raw)
		);
		return context.json(client, 201, { "Cache-Control": "no-store" });
	} catch (error) {
		return oauthFailure(context, error);
	}
});

async function readParams(request: Request): Promise<Record<string, string>> {
	const type = request.headers.get("Content-Type") ?? "";
	if (type.includes("application/json")) {
		const body = await readJson(request);
		return Object.fromEntries(
			Object.entries(body as Record<string, unknown>).filter(
				(entry): entry is [string, string] => typeof entry[1] === "string"
			)
		);
	}
	return Object.fromEntries(new URLSearchParams(await request.text()));
}

app.post("/oauth/token", async (context) => {
	try {
		const tokens = await exchangeToken(
			createDb(context.env.DB),
			await readParams(context.req.raw),
			context.req.header("Authorization") ?? null,
			Date.now()
		);
		return context.json(tokens, 200, {
			"Cache-Control": "no-store",
			Pragma: "no-cache",
		});
	} catch (error) {
		return oauthFailure(context, error);
	}
});

app.post("/mcp", async (context) => {
	const ctx = await tokenContext(
		context.env,
		context.req.header("Authorization")
	);
	if (!ctx) {
		return context.json(
			{
				error: {
					code: -32_001,
					message: "Unauthorized: sign in to Mine",
				},
				id: null,
				jsonrpc: "2.0",
			},
			401,
			{
				"WWW-Authenticate": `Bearer resource_metadata="${origin(context)}/.well-known/oauth-protected-resource/mcp"`,
			}
		);
	}
	const caller = appRouter.createCaller(ctx);
	const reply = await handleMcp(await context.req.text(), () => ({
		caller,
		now: Date.now(),
		timeZone: DEFAULT_TIME_ZONE,
	}));
	return reply === null ? context.body(null, 202) : context.json(reply);
});

app.on(["GET", "DELETE"], "/mcp", (context) =>
	context.body(null, 405, { Allow: "POST" })
);

app.get("/", (context) => context.text("OK"));

export { app };
export default app;
