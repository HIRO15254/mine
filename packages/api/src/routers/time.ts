import { project, task } from "@mine/db/schema/tasks";
import { projectRate, timeEntry } from "@mine/db/schema/time";
import { TRPCError } from "@trpc/server";
import { and, desc, eq, gt, isNull, lt, or, sql } from "drizzle-orm";
import { z } from "zod";

import type { Context } from "../context";
import { protectedProcedure, router } from "../index";
import { assertProject } from "../projects/owned";
import {
	entryDescription,
	instant,
	MAX_ENTRY_SPAN,
	MAX_LIST_SPAN,
	MAX_SUMMARY_SPAN,
} from "../time/schema";
import { isTimeZone, summarize } from "../time/summary";

type Db = Pick<Context, "db">;

const timeZone = z
	.string()
	.refine(isTimeZone, { message: "Unknown time zone" });

type EntryRow = typeof timeEntry.$inferSelect;

function toEntry(row: EntryRow) {
	return {
		billable: row.billable,
		description: row.description,
		endedAt: row.endedAt,
		id: row.id,
		projectId: row.projectId,
		startedAt: row.startedAt,
		taskId: row.taskId,
	};
}

export type TimeEntry = ReturnType<typeof toEntry>;

function badRequest(message: string): never {
	throw new TRPCError({ code: "BAD_REQUEST", message });
}

async function findOwnedTask(ctx: Db, userId: string, taskId: string) {
	const [row] = await ctx.db
		.select({ id: task.id, projectId: task.projectId, title: task.title })
		.from(task)
		.where(and(eq(task.id, taskId), eq(task.userId, userId)))
		.limit(1);
	if (!row) {
		badRequest("Unknown task");
	}
	return row;
}

async function assertRefs(
	ctx: Db,
	userId: string,
	refs: { projectId?: string | null; taskId?: string | null }
) {
	if (refs.projectId) {
		await assertProject(ctx, userId, refs.projectId);
	}
	if (refs.taskId) {
		await findOwnedTask(ctx, userId, refs.taskId);
	}
}

/**
 * Checks a new entry's project and task. The task lends its title and its
 * project when the entry names none; an explicit null keeps it without one.
 */
async function resolveEntryRefs(
	ctx: Db,
	userId: string,
	input: {
		description?: string;
		projectId?: string | null;
		taskId?: string | null;
	}
) {
	let projectId = input.projectId ?? null;
	let text = input.description ?? "";
	if (input.taskId) {
		const owned = await findOwnedTask(ctx, userId, input.taskId);
		projectId = input.projectId === undefined ? owned.projectId : projectId;
		text = text || owned.title;
	}
	if (projectId) {
		await assertProject(ctx, userId, projectId);
	}
	return { description: text, projectId };
}

async function findEntry(ctx: Db, userId: string, id: string) {
	const [row] = await ctx.db
		.select()
		.from(timeEntry)
		.where(and(eq(timeEntry.id, id), eq(timeEntry.userId, userId)))
		.limit(1);
	if (!row) {
		throw new TRPCError({ code: "NOT_FOUND", message: "Entry not found" });
	}
	return row;
}

function running(userId: string) {
	return and(eq(timeEntry.userId, userId), isNull(timeEntry.endedAt));
}

async function runningEntry(ctx: Db, userId: string) {
	const [row] = await ctx.db
		.select()
		.from(timeEntry)
		.where(running(userId))
		.orderBy(desc(timeEntry.startedAt))
		.limit(1);
	return row ?? null;
}

/** Stops the running entry; a start time in the future is pulled back. */
async function stopRunning(ctx: Db, userId: string, now: number) {
	const current = await runningEntry(ctx, userId);
	if (!current) {
		return null;
	}
	const endedAt = Math.max(now, current.startedAt);
	await ctx.db.update(timeEntry).set({ endedAt }).where(running(userId));
	return toEntry({ ...current, endedAt });
}

function assertSpan(startedAt: number, endedAt: number | null) {
	if (endedAt === null) {
		return;
	}
	if (endedAt <= startedAt) {
		badRequest("The end must be after the start");
	}
	if (endedAt - startedAt > MAX_ENTRY_SPAN) {
		badRequest("An entry can be at most 7 days long");
	}
}

function overlapping(userId: string, from: number, to: number) {
	return and(
		eq(timeEntry.userId, userId),
		lt(timeEntry.startedAt, to),
		or(isNull(timeEntry.endedAt), gt(timeEntry.endedAt, from))
	);
}

const rangeInput = (maxSpan: number) =>
	z
		.object({ from: instant, to: instant })
		.refine((range) => range.to > range.from, { message: "Empty range" })
		.refine((range) => range.to - range.from <= maxSpan, {
			message: "Range too long",
		});

const entryFields = {
	billable: z.boolean().optional(),
	description: entryDescription.optional(),
	projectId: z.string().min(1).nullish(),
	taskId: z.string().min(1).nullish(),
};

export const timeRouter = router({
	current: protectedProcedure.query(async ({ ctx }) => {
		const row = await runningEntry(ctx, ctx.session.user.id);
		return row ? toEntry(row) : null;
	}),

	/**
	 * Starts the timer, stopping any running entry first. `startedAt` backdates
	 * it, e.g. to the start of an event already under way.
	 */
	start: protectedProcedure
		.input(z.object({ ...entryFields, startedAt: instant.optional() }))
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			const refs = await resolveEntryRefs(ctx, userId, input);
			const now = ctx.now();
			const startedAt = input.startedAt ?? now;
			if (startedAt > now || now - startedAt > MAX_ENTRY_SPAN) {
				badRequest("startedAt must be in the past week");
			}
			const row = {
				...refs,
				billable: input.billable ?? true,
				endedAt: null,
				id: crypto.randomUUID(),
				startedAt,
				taskId: input.taskId ?? null,
				userId,
			};
			// One transaction, so two starts at once cannot leave two timers
			// running. A backdated start also ends the running entry there.
			await ctx.db.batch([
				ctx.db
					.update(timeEntry)
					.set({ endedAt: sql`max(${timeEntry.startedAt}, ${startedAt})` })
					.where(running(userId)),
				ctx.db.insert(timeEntry).values(row),
			]);
			return toEntry({ ...row, createdAt: new Date(now) });
		}),

	stop: protectedProcedure.mutation(({ ctx }) =>
		stopRunning(ctx, ctx.session.user.id, ctx.now())
	),

	/** Entries that overlap [from, to), newest first. */
	list: protectedProcedure
		.input(rangeInput(MAX_LIST_SPAN))
		.query(async ({ ctx, input }) => {
			const rows = await ctx.db
				.select()
				.from(timeEntry)
				.where(overlapping(ctx.session.user.id, input.from, input.to))
				.orderBy(desc(timeEntry.startedAt));
			return rows.map(toEntry);
		}),

	create: protectedProcedure
		.input(z.object({ ...entryFields, endedAt: instant, startedAt: instant }))
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			assertSpan(input.startedAt, input.endedAt);
			const refs = await resolveEntryRefs(ctx, userId, input);
			const row = {
				...refs,
				billable: input.billable ?? true,
				endedAt: input.endedAt,
				id: crypto.randomUUID(),
				startedAt: input.startedAt,
				taskId: input.taskId ?? null,
				userId,
			};
			await ctx.db.insert(timeEntry).values(row);
			return toEntry(await findEntry(ctx, userId, row.id));
		}),

	update: protectedProcedure
		.input(
			z.object({
				...entryFields,
				endedAt: instant.optional(),
				id: z.string().min(1),
				startedAt: instant.optional(),
			})
		)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			const current = await findEntry(ctx, userId, input.id);
			const startedAt = input.startedAt ?? current.startedAt;
			const endedAt = input.endedAt ?? current.endedAt;
			// A forgotten timer can run past the limit; renaming it must still work.
			if (input.startedAt !== undefined || input.endedAt !== undefined) {
				assertSpan(startedAt, endedAt);
			}
			if (endedAt === null && startedAt > ctx.now()) {
				badRequest("A running entry cannot start in the future");
			}
			await assertRefs(ctx, userId, input);
			const { id, ...fields } = input;
			const changes = Object.fromEntries(
				Object.entries(fields).filter(([, value]) => value !== undefined)
			);
			if (Object.keys(changes).length > 0) {
				await ctx.db
					.update(timeEntry)
					.set(changes)
					.where(and(eq(timeEntry.id, id), eq(timeEntry.userId, userId)));
			}
			return toEntry(await findEntry(ctx, userId, id));
		}),

	delete: protectedProcedure
		.input(z.object({ id: z.string().min(1) }))
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			await findEntry(ctx, userId, input.id);
			await ctx.db
				.delete(timeEntry)
				.where(and(eq(timeEntry.id, input.id), eq(timeEntry.userId, userId)));
			return { id: input.id };
		}),

	/** Totals by project and day, with billable amounts from project rates. */
	summary: protectedProcedure
		.input(z.intersection(rangeInput(MAX_SUMMARY_SPAN), z.object({ timeZone })))
		.query(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			const [entries, projects, rates] = await Promise.all([
				ctx.db
					.select()
					.from(timeEntry)
					.where(overlapping(userId, input.from, input.to)),
				ctx.db
					.select({ id: project.id, parentId: project.parentId })
					.from(project)
					.where(eq(project.userId, userId)),
				ctx.db
					.select({
						effectiveFrom: projectRate.effectiveFrom,
						hourlyRate: projectRate.hourlyRate,
						projectId: projectRate.projectId,
					})
					.from(projectRate)
					.innerJoin(project, eq(project.id, projectRate.projectId))
					.where(eq(project.userId, userId)),
			]);
			return summarize(entries, {
				from: input.from,
				now: ctx.now(),
				projects,
				rates,
				timeZone: input.timeZone,
				to: input.to,
			});
		}),
});
