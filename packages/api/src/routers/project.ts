import { PROJECT_COLORS, project } from "@mine/db/schema/tasks";
import { timeEntry } from "@mine/db/schema/time";
import { TRPCError } from "@trpc/server";
import { and, asc, eq, isNull, max } from "drizzle-orm";
import { z } from "zod";

import type { Context } from "../context";
import { protectedProcedure, router } from "../index";

const nameSchema = z.string().trim().min(1).max(100);
const colorSchema = z.enum(PROJECT_COLORS);

async function findProject(
	ctx: Pick<Context, "db">,
	userId: string,
	id: string
) {
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

/** Rejects a parent that is the project itself or one of its descendants. */
async function assertNoCycle(
	ctx: Pick<Context, "db">,
	userId: string,
	id: string,
	parentId: string
) {
	let current: string | null = parentId;
	for (let depth = 0; current !== null && depth < 100; depth += 1) {
		if (current === id) {
			throw new TRPCError({
				code: "BAD_REQUEST",
				message: "A project cannot be moved under itself",
			});
		}
		current = (await findProject(ctx, userId, current)).parentId;
	}
}

export const projectRouter = router({
	list: protectedProcedure.query(({ ctx }) =>
		ctx.db
			.select({
				archived: project.archived,
				color: project.color,
				id: project.id,
				name: project.name,
				parentId: project.parentId,
				sortOrder: project.sortOrder,
			})
			.from(project)
			.where(eq(project.userId, ctx.session.user.id))
			.orderBy(asc(project.sortOrder), asc(project.name))
	),

	create: protectedProcedure
		.input(
			z.object({
				color: colorSchema.optional(),
				name: nameSchema,
				parentId: z.string().min(1).nullish(),
			})
		)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			if (input.parentId) {
				await findProject(ctx, userId, input.parentId);
			}
			const siblings = input.parentId
				? eq(project.parentId, input.parentId)
				: isNull(project.parentId);
			const [last] = await ctx.db
				.select({ value: max(project.sortOrder) })
				.from(project)
				.where(and(eq(project.userId, userId), siblings));
			const row = {
				color: input.color ?? "chart-1",
				id: crypto.randomUUID(),
				name: input.name,
				parentId: input.parentId ?? null,
				sortOrder: (last?.value ?? -1) + 1,
				userId,
			} as const;
			await ctx.db.insert(project).values(row);
			return { ...row, archived: false };
		}),

	update: protectedProcedure
		.input(
			z.object({
				archived: z.boolean().optional(),
				color: colorSchema.optional(),
				id: z.string().min(1),
				name: nameSchema.optional(),
				parentId: z.string().min(1).nullish(),
			})
		)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			await findProject(ctx, userId, input.id);
			if (input.parentId) {
				await assertNoCycle(ctx, userId, input.id, input.parentId);
			}
			const { id, ...fields } = input;
			const changes = Object.fromEntries(
				Object.entries(fields).filter(([, value]) => value !== undefined)
			);
			if (Object.keys(changes).length > 0) {
				await ctx.db
					.update(project)
					.set(changes)
					.where(and(eq(project.id, id), eq(project.userId, userId)));
			}
			return findProject(ctx, userId, id);
		}),

	/**
	 * Deletes the project and its subprojects; their tasks move to the inbox.
	 * Refused while any of them has tracked time: the entries would lose their
	 * project and its rates, which rewrites past totals. Archive those instead.
	 */
	delete: protectedProcedure
		.input(z.object({ id: z.string().min(1) }))
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			await findProject(ctx, userId, input.id);
			const [all, tracked] = await Promise.all([
				ctx.db
					.select({ id: project.id, parentId: project.parentId })
					.from(project)
					.where(eq(project.userId, userId)),
				ctx.db
					.selectDistinct({ projectId: timeEntry.projectId })
					.from(timeEntry)
					.where(eq(timeEntry.userId, userId)),
			]);
			const doomed = new Set([input.id]);
			for (let grew = true; grew; ) {
				grew = false;
				for (const item of all) {
					if (
						item.parentId &&
						doomed.has(item.parentId) &&
						!doomed.has(item.id)
					) {
						doomed.add(item.id);
						grew = true;
					}
				}
			}
			if (tracked.some((row) => row.projectId && doomed.has(row.projectId))) {
				throw new TRPCError({
					code: "CONFLICT",
					message: "The project has time entries; archive it instead",
				});
			}
			await ctx.db
				.delete(project)
				.where(and(eq(project.id, input.id), eq(project.userId, userId)));
			return { id: input.id };
		}),
});
