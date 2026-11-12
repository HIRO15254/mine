import { label } from "@mine/db/schema/tasks";
import { TRPCError } from "@trpc/server";
import { and, asc, eq, max } from "drizzle-orm";
import { z } from "zod";

import type { Context } from "../context";
import { protectedProcedure, router } from "../index";

const nameSchema = z.string().trim().min(1).max(50);

/**
 * A label is looked up without regard to case everywhere ("@Next", "next"),
 * so two names that differ only in case would be one label to every lookup.
 * The unique index compares exactly; this check is the one that sees case.
 */
async function assertNameFree(
	ctx: Pick<Context, "db">,
	userId: string,
	name: string,
	exceptId?: string
) {
	const wanted = name.toLowerCase();
	const labels = await ctx.db
		.select({ id: label.id, name: label.name })
		.from(label)
		.where(eq(label.userId, userId));
	const existing = labels.find((item) => item.name.toLowerCase() === wanted);
	if (existing && existing.id !== exceptId) {
		throw new TRPCError({
			code: "CONFLICT",
			message: "A label with this name already exists",
		});
	}
}

export const labelRouter = router({
	list: protectedProcedure.query(({ ctx }) =>
		ctx.db
			.select({ id: label.id, name: label.name, sortOrder: label.sortOrder })
			.from(label)
			.where(eq(label.userId, ctx.session.user.id))
			.orderBy(asc(label.sortOrder), asc(label.name))
	),

	create: protectedProcedure
		.input(z.object({ name: nameSchema }))
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			await assertNameFree(ctx, userId, input.name);
			const [last] = await ctx.db
				.select({ value: max(label.sortOrder) })
				.from(label)
				.where(eq(label.userId, userId));
			const row = {
				id: crypto.randomUUID(),
				name: input.name,
				sortOrder: (last?.value ?? -1) + 1,
				userId,
			};
			await ctx.db.insert(label).values(row);
			return { id: row.id, name: row.name, sortOrder: row.sortOrder };
		}),

	update: protectedProcedure
		.input(z.object({ id: z.string().min(1), name: nameSchema }))
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			await assertNameFree(ctx, userId, input.name, input.id);
			const updated = await ctx.db
				.update(label)
				.set({ name: input.name })
				.where(and(eq(label.id, input.id), eq(label.userId, userId)))
				.returning({ id: label.id, name: label.name });
			if (updated.length === 0) {
				throw new TRPCError({ code: "NOT_FOUND", message: "Label not found" });
			}
			return updated[0];
		}),

	delete: protectedProcedure
		.input(z.object({ id: z.string().min(1) }))
		.mutation(async ({ ctx, input }) => {
			const deleted = await ctx.db
				.delete(label)
				.where(
					and(eq(label.id, input.id), eq(label.userId, ctx.session.user.id))
				)
				.returning({ id: label.id });
			if (deleted.length === 0) {
				throw new TRPCError({ code: "NOT_FOUND", message: "Label not found" });
			}
			return { id: input.id };
		}),
});
