import { project } from "@mine/db/schema/tasks";
import { projectRate } from "@mine/db/schema/time";
import { TRPCError } from "@trpc/server";
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";

import type { Context } from "../context";
import { protectedProcedure, router } from "../index";
import { isDayKey } from "../tasks/dates";

type Db = Pick<Context, "db">;

async function assertProject(ctx: Db, userId: string, projectId: string) {
	const [row] = await ctx.db
		.select({ id: project.id })
		.from(project)
		.where(and(eq(project.id, projectId), eq(project.userId, userId)))
		.limit(1);
	if (!row) {
		throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
	}
}

const rateColumns = {
	effectiveFrom: projectRate.effectiveFrom,
	hourlyRate: projectRate.hourlyRate,
	id: projectRate.id,
	projectId: projectRate.projectId,
};

/** Hourly rates per project, effective from a day; children inherit them. */
export const rateRouter = router({
	list: protectedProcedure.query(({ ctx }) =>
		ctx.db
			.select(rateColumns)
			.from(projectRate)
			.innerJoin(project, eq(project.id, projectRate.projectId))
			.where(eq(project.userId, ctx.session.user.id))
			.orderBy(asc(projectRate.projectId), asc(projectRate.effectiveFrom))
	),

	/** Adds a rate, or replaces the one starting on the same day. */
	set: protectedProcedure
		.input(
			z.object({
				effectiveFrom: z
					.string()
					.refine(isDayKey, { message: "Expected YYYY-MM-DD" }),
				hourlyRate: z.number().int().min(0).max(1_000_000),
				projectId: z.string().min(1),
			})
		)
		.mutation(async ({ ctx, input }) => {
			await assertProject(ctx, ctx.session.user.id, input.projectId);
			await ctx.db
				.insert(projectRate)
				.values({ ...input, id: crypto.randomUUID() })
				.onConflictDoUpdate({
					set: { hourlyRate: input.hourlyRate },
					target: [projectRate.projectId, projectRate.effectiveFrom],
				});
			const [row] = await ctx.db
				.select(rateColumns)
				.from(projectRate)
				.where(
					and(
						eq(projectRate.projectId, input.projectId),
						eq(projectRate.effectiveFrom, input.effectiveFrom)
					)
				)
				.limit(1);
			if (!row) {
				throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
			}
			return row;
		}),

	delete: protectedProcedure
		.input(z.object({ id: z.string().min(1) }))
		.mutation(async ({ ctx, input }) => {
			const [row] = await ctx.db
				.select({ id: projectRate.id })
				.from(projectRate)
				.innerJoin(project, eq(project.id, projectRate.projectId))
				.where(
					and(
						eq(projectRate.id, input.id),
						eq(project.userId, ctx.session.user.id)
					)
				)
				.limit(1);
			if (!row) {
				throw new TRPCError({ code: "NOT_FOUND", message: "Rate not found" });
			}
			await ctx.db.delete(projectRate).where(eq(projectRate.id, input.id));
			return { id: input.id };
		}),
});
