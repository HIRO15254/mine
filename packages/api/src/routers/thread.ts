import { claudeThread } from "@mine/db/schema/claude";
import { TRPCError } from "@trpc/server";
import { and, desc, eq, ne } from "drizzle-orm";
import { z } from "zod";

import type { Context } from "../context";
import { protectedProcedure, router } from "../index";
import { assertProject } from "../projects/owned";
import { threadFields } from "../threads/schema";

type Db = Pick<Context, "db">;

type ThreadRow = typeof claudeThread.$inferSelect;

function toThread(row: ThreadRow) {
	return {
		id: row.id,
		nextAction: row.nextAction,
		projectId: row.projectId,
		status: row.status,
		summary: row.summary,
		title: row.title,
		updatedAt: row.updatedAt,
		url: row.url,
	};
}

export type ClaudeThread = ReturnType<typeof toThread>;

async function findOwned(ctx: Db, userId: string, id: string) {
	const [row] = await ctx.db
		.select()
		.from(claudeThread)
		.where(and(eq(claudeThread.id, id), eq(claudeThread.userId, userId)))
		.limit(1);
	if (!row) {
		throw new TRPCError({ code: "NOT_FOUND", message: "Thread not found" });
	}
	return row;
}

async function findByUrl(ctx: Db, userId: string, url: string) {
	const [row] = await ctx.db
		.select({ id: claudeThread.id })
		.from(claudeThread)
		.where(and(eq(claudeThread.userId, userId), eq(claudeThread.url, url)))
		.orderBy(desc(claudeThread.updatedAt))
		.limit(1);
	return row?.id ?? null;
}

export const threadRouter = router({
	/** Newest first; finished threads only when asked. */
	list: protectedProcedure
		.input(z.object({ includeDone: z.boolean().default(false) }).optional())
		.query(async ({ ctx, input }) => {
			const conditions = [eq(claudeThread.userId, ctx.session.user.id)];
			if (!input?.includeDone) {
				conditions.push(ne(claudeThread.status, "done"));
			}
			const rows = await ctx.db
				.select()
				.from(claudeThread)
				.where(and(...conditions))
				.orderBy(desc(claudeThread.updatedAt))
				.limit(100);
			return rows.map(toThread);
		}),

	/**
	 * Creates or updates a thread: by id when given, otherwise by URL, so a
	 * conversation that reports again updates its own row.
	 */
	report: protectedProcedure
		.input(
			z.object({ ...threadFields, projectId: z.string().min(1).nullish() })
		)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			if (input.projectId) {
				await assertProject(ctx, userId, input.projectId);
			}
			const existing = input.id
				? (await findOwned(ctx, userId, input.id)).id
				: input.url && (await findByUrl(ctx, userId, input.url));
			const fields = {
				nextAction: input.status === "waiting" ? (input.nextAction ?? "") : "",
				status: input.status,
				title: input.title,
				updatedAt: ctx.now(),
				...(input.summary === undefined ? {} : { summary: input.summary }),
				...(input.url === undefined ? {} : { url: input.url }),
				...(input.projectId === undefined
					? {}
					: { projectId: input.projectId }),
			};
			const id = existing || crypto.randomUUID();
			if (existing) {
				await ctx.db
					.update(claudeThread)
					.set(fields)
					.where(eq(claudeThread.id, id));
			} else {
				await ctx.db.insert(claudeThread).values({ ...fields, id, userId });
			}
			return toThread(await findOwned(ctx, userId, id));
		}),

	setStatus: protectedProcedure
		.input(z.object({ id: z.string().min(1), status: threadFields.status }))
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			await findOwned(ctx, userId, input.id);
			await ctx.db
				.update(claudeThread)
				.set({
					status: input.status,
					updatedAt: ctx.now(),
					...(input.status === "waiting" ? {} : { nextAction: "" }),
				})
				.where(eq(claudeThread.id, input.id));
			return toThread(await findOwned(ctx, userId, input.id));
		}),

	delete: protectedProcedure
		.input(z.object({ id: z.string().min(1) }))
		.mutation(async ({ ctx, input }) => {
			await findOwned(ctx, ctx.session.user.id, input.id);
			await ctx.db.delete(claudeThread).where(eq(claudeThread.id, input.id));
			return { id: input.id };
		}),
});
