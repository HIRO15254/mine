import type { Database } from "@mine/db";

export interface Context extends Record<string, unknown> {
	db: Database;
}

export function createContextFactory(db: Database): () => Promise<Context> {
	return () => Promise.resolve({ db });
}
