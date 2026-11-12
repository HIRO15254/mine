import { project } from "@mine/db/schema/tasks";
import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";

import type { Context } from "../context";

type Db = Pick<Context, "db">;

/**
 * The user's project the request is about (rename it, archive it), or
 * NOT_FOUND. Another user's project is as absent as one that does not exist.
 */
export async function findProject(ctx: Db, userId: string, id: string) {
	const [row] = await ctx.db
		.select()
		.from(project)
		.where(and(eq(project.id, id), eq(project.userId, userId)))
		.limit(1);
	if (!row) {
		throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
	}
	return row;
}

/**
 * Checks a project that something else points at (a task, a time entry, a
 * rate, a thread). A bad id there is a mistake in the input: BAD_REQUEST.
 */
export async function assertProject(
	ctx: Db,
	userId: string,
	projectId: string
) {
	const [row] = await ctx.db
		.select({ id: project.id })
		.from(project)
		.where(and(eq(project.id, projectId), eq(project.userId, userId)))
		.limit(1);
	if (!row) {
		throw new TRPCError({ code: "BAD_REQUEST", message: "Unknown project" });
	}
}
