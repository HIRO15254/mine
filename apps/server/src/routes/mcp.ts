import { DEFAULT_TIME_ZONE, handleMcp } from "@mine/api/mcp/server";
import { Hono } from "hono";

import { type AppEnv, originOf } from "../http";
import { resolveCaller } from "../session";

/**
 * `/mcp`: tools for Claude. Claude signs in through OAuth (see `oauth.ts`);
 * Claude Code can also send a personal API token as a bearer header.
 */
export const mcpRoutes = new Hono<AppEnv>();

mcpRoutes.post("/mcp", async (context) => {
	const caller = await resolveCaller(context.env, context.req.raw.headers, [
		"api-token",
		"oauth",
	]);
	if (!caller) {
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
				"WWW-Authenticate": `Bearer resource_metadata="${originOf(context)}/.well-known/oauth-protected-resource/mcp"`,
			}
		);
	}
	const web = context.env.CORS_ORIGIN;
	const reply = await handleMcp(
		await context.req.text(),
		() => ({ caller, now: Date.now(), timeZone: DEFAULT_TIME_ZONE }),
		{
			// The Mine mark, served by the web app.
			icons: [
				{
					mimeType: "image/png",
					sizes: ["192x192"],
					src: `${web}/pwa-192x192.png`,
				},
				{
					mimeType: "image/png",
					sizes: ["512x512"],
					src: `${web}/pwa-512x512.png`,
				},
			],
			websiteUrl: web,
		}
	);
	return reply === null ? context.body(null, 202) : context.json(reply);
});

mcpRoutes.on(["GET", "DELETE"], "/mcp", (context) =>
	context.body(null, 405, { Allow: "POST" })
);
