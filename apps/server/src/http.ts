import type { Context } from "hono";

import type { Bindings } from "./bindings";

export interface AppEnv {
	Bindings: Bindings;
}

/** The API's own origin, as the request reached it. */
export const originOf = (context: Context) => new URL(context.req.url).origin;

/** The JSON body, or an empty object when there is none. Throws SyntaxError. */
export async function readJson(request: Request): Promise<unknown> {
	const text = await request.text();
	return text.trim() ? JSON.parse(text) : {};
}
