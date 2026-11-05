import { trpcServer } from "@hono/trpc-server";
import { createContextFactory } from "@mine/api/context";
import { appRouter } from "@mine/api/routers/index";
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

app.get("/", (context) => context.text("OK"));

export { app };
export default app;
