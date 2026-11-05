import type { Database } from "@mine/db";

export interface SessionUser {
	email: string;
	id: string;
	image?: string | null;
	name: string;
}

export interface Session {
	user: SessionUser;
}

export type SessionResolver = () => Promise<Session | null>;

export interface Context extends Record<string, unknown> {
	db: Database;
	resolveSession: SessionResolver;
}

const noSession: SessionResolver = () => Promise.resolve(null);

export function createContextFactory(
	db: Database,
	resolveSession: SessionResolver = noSession
): () => Promise<Context> {
	return () => Promise.resolve({ db, resolveSession });
}
