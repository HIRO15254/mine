import {
	approveAuthorization,
	authorizationServerMetadata,
	checkAuthorization,
	deniedRedirect,
	exchangeToken,
	OAuthError,
	protectedResourceMetadata,
	registerClient,
} from "@mine/api/oauth";
import { createDb } from "@mine/db";
import { type Context, Hono } from "hono";
import { bodyLimit } from "hono/body-limit";

import { type AppEnv, originOf, readJson } from "../http";
import {
	consentPage,
	consentToken,
	errorPage,
	PAGE_HEADERS,
} from "../oauth-pages";
import { authFor, cookieSession } from "../session";

/**
 * Mine's own OAuth server, which lets Claude sign in to `/mcp`: discovery
 * documents, dynamic client registration, the consent screen and the token
 * endpoint (authorization code with PKCE, and refresh).
 */
export const oauthRoutes = new Hono<AppEnv>();

oauthRoutes.get("/.well-known/oauth-authorization-server", (context) =>
	context.json(authorizationServerMetadata(originOf(context)))
);

for (const path of [
	"/.well-known/oauth-protected-resource",
	"/.well-known/oauth-protected-resource/*",
]) {
	oauthRoutes.get(path, (context) =>
		context.json(
			protectedResourceMetadata(`${originOf(context)}/mcp`, originOf(context))
		)
	);
}

// Every body here is a few hundred bytes, and anyone can send one.
oauthRoutes.use(
	"/oauth/*",
	bodyLimit({
		maxSize: 16 * 1024,
		onError: (context) =>
			context.json(
				{ error: "invalid_request", error_description: "Body too large" },
				413
			),
	})
);

const htmlPage = (body: string, status: 200 | 400 | 403 = 200) =>
	new Response(body, { headers: PAGE_HEADERS, status });

/** Sends the user to Google, then back to the same authorize URL. */
async function startSignIn(context: Context<AppEnv>) {
	const auth = authFor(context.env, createDb(context.env.DB));
	const response = await auth.api.signInSocial({
		asResponse: true,
		body: {
			callbackURL: context.req.url,
			disableRedirect: true,
			errorCallbackURL: `${originOf(context)}/oauth/sign-in-failed`,
			provider: "google",
		},
		headers: context.req.raw.headers,
	});
	const { url } = (await response.json()) as { url?: string };
	if (!url) {
		return htmlPage(errorPage("ログインを始められませんでした"), 400);
	}
	const headers = new Headers({ "Cache-Control": "no-store", Location: url });
	for (const cookie of response.headers.getSetCookie()) {
		headers.append("Set-Cookie", cookie);
	}
	return new Response(null, { headers, status: 302 });
}

oauthRoutes.get("/oauth/authorize", async (context) => {
	const db = createDb(context.env.DB);
	const check = await checkAuthorization(db, context.req.query());
	if (!check.ok) {
		return htmlPage(errorPage(check.error), 400);
	}
	const session = await cookieSession(
		context.env,
		authFor(context.env, db),
		context.req.raw.headers
	);
	if (!session) {
		return startSignIn(context);
	}
	return htmlPage(
		consentPage({
			clientName: check.clientName,
			csrf: await consentToken(
				context.env.BETTER_AUTH_SECRET,
				session.session.id,
				check.request
			),
			email: session.user.email,
			request: check.request,
		})
	);
});

oauthRoutes.post("/oauth/authorize", async (context) => {
	// The form's token is the real check; this only turns away other sites
	// that announce themselves. Some privacy settings send "null".
	const sentFrom = context.req.header("Origin");
	if (sentFrom && sentFrom !== "null" && sentFrom !== originOf(context)) {
		return htmlPage(errorPage("別のサイトからの送信は受け付けません"), 403);
	}
	const db = createDb(context.env.DB);
	const form = Object.fromEntries(
		new URLSearchParams(await context.req.text())
	);
	const check = await checkAuthorization(db, form);
	if (!check.ok) {
		return htmlPage(errorPage(check.error), 400);
	}
	const session = await cookieSession(
		context.env,
		authFor(context.env, db),
		context.req.raw.headers
	);
	const expected = session
		? await consentToken(
				context.env.BETTER_AUTH_SECRET,
				session.session.id,
				check.request
			)
		: null;
	if (!(session && expected === form.csrf)) {
		return htmlPage(
			errorPage("確認画面の有効期限が切れました。もう一度接続してください"),
			403
		);
	}
	const location =
		form.decision === "allow"
			? await approveAuthorization(
					db,
					{ ...check.request, userId: session.user.id },
					Date.now()
				)
			: deniedRedirect(check.request.redirectUri, check.request.state);
	return context.redirect(location, 303);
});

oauthRoutes.get("/oauth/sign-in-failed", () =>
	htmlPage(
		errorPage(
			"Google でログインできませんでした。許可されたアカウントで、もう一度接続してください"
		),
		403
	)
);

function oauthFailure(context: Context, error: unknown) {
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

oauthRoutes.post("/oauth/register", async (context) => {
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

/** The token request's fields, sent as a form or as JSON. */
async function readParams(request: Request): Promise<Record<string, string>> {
	const type = request.headers.get("Content-Type") ?? "";
	if (type.includes("application/json")) {
		const body = await readJson(request);
		if (typeof body !== "object" || body === null) {
			return {};
		}
		return Object.fromEntries(
			Object.entries(body as Record<string, unknown>).filter(
				(entry): entry is [string, string] => typeof entry[1] === "string"
			)
		);
	}
	return Object.fromEntries(new URLSearchParams(await request.text()));
}

oauthRoutes.post("/oauth/token", async (context) => {
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
