export type Bindings = Omit<Env, "CORS_ORIGIN"> & {
	ALLOWED_EMAILS?: string;
	BETTER_AUTH_SECRET: string;
	BETTER_AUTH_URL: string;
	CORS_ORIGIN: string;
	GOOGLE_CLIENT_ID: string;
	GOOGLE_CLIENT_SECRET: string;
};
