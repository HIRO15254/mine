import type { Database } from "@mine/db";
import { schema } from "@mine/db/schema";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError } from "better-auth/api";

import { isEmailAllowed } from "./allowlist";

export interface AuthOptions {
	allowedEmails: readonly string[];
	baseURL: string;
	corsOrigin: string;
	googleClientId: string;
	googleClientSecret: string;
	secret: string;
}

export function createAuth(db: Database, options: AuthOptions) {
	return betterAuth({
		secret: options.secret,
		baseURL: options.baseURL,
		database: drizzleAdapter(db, { provider: "sqlite", schema }),
		trustedOrigins: [options.corsOrigin],
		advanced: {
			defaultCookieAttributes: {
				sameSite: "none",
				secure: true,
				httpOnly: true,
			},
		},
		socialProviders: {
			google: {
				clientId: options.googleClientId,
				clientSecret: options.googleClientSecret,
				prompt: "select_account",
			},
		},
		databaseHooks: {
			user: {
				create: {
					before: (user) => {
						if (!isEmailAllowed(user.email, options.allowedEmails)) {
							throw new APIError("FORBIDDEN", {
								message: "This account is not allowed to sign in",
							});
						}
						return Promise.resolve({ data: user });
					},
				},
			},
		},
	});
}

export type Auth = ReturnType<typeof createAuth>;
