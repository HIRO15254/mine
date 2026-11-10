import { calendarPreference } from "@mine/db/schema/calendar";
import { TRPCError } from "@trpc/server";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";

import type { Context } from "../context";
import {
	type CalendarEvent,
	createGoogleCalendarClient,
	GoogleCalendarAuthError,
	type GoogleCalendarClient,
} from "../google/calendar";
import { protectedProcedure, router } from "../index";

/** Shown to the web client so it can offer to reconnect Google. */
export const CALENDAR_NOT_CONNECTED = "GOOGLE_CALENDAR_NOT_CONNECTED";

const MAX_RANGE_MS = 62 * 24 * 60 * 60 * 1000;

const rangeInput = z
	.object({
		timeMax: z.iso.datetime({ offset: true }),
		timeMin: z.iso.datetime({ offset: true }),
	})
	.refine(
		(range) => {
			const span = Date.parse(range.timeMax) - Date.parse(range.timeMin);
			return span > 0 && span <= MAX_RANGE_MS;
		},
		{ message: "timeMax must be after timeMin and within 62 days" }
	);

function notConnected(): TRPCError {
	return new TRPCError({
		code: "PRECONDITION_FAILED",
		message: CALENDAR_NOT_CONNECTED,
	});
}

async function withGoogle<T>(
	ctx: Pick<Context, "fetch" | "getGoogleAccessToken">,
	run: (client: GoogleCalendarClient) => Promise<T>
): Promise<T> {
	const token = await ctx.getGoogleAccessToken();
	if (!token) {
		throw notConnected();
	}
	try {
		return await run(createGoogleCalendarClient(token, ctx.fetch));
	} catch (error) {
		if (error instanceof GoogleCalendarAuthError) {
			throw notConnected();
		}
		throw error;
	}
}

async function calendarsWithVisibility(
	ctx: Pick<Context, "db">,
	userId: string,
	client: GoogleCalendarClient
) {
	const [calendars, preferences] = await Promise.all([
		client.listCalendars(),
		ctx.db
			.select({
				calendarId: calendarPreference.calendarId,
				visible: calendarPreference.visible,
			})
			.from(calendarPreference)
			.where(eq(calendarPreference.userId, userId)),
	]);
	const visibility = new Map(
		preferences.map((row) => [row.calendarId, row.visible])
	);
	return calendars
		.map((calendar) => ({
			color: calendar.color,
			id: calendar.id,
			name: calendar.name,
			primary: calendar.primary,
			visible: visibility.get(calendar.id) ?? calendar.selected,
		}))
		.sort((a, b) => Number(b.primary) - Number(a.primary));
}

export const calendarRouter = router({
	calendars: protectedProcedure.query(({ ctx }) =>
		withGoogle(ctx, (client) =>
			calendarsWithVisibility(ctx, ctx.session.user.id, client)
		)
	),

	setVisibility: protectedProcedure
		.input(z.object({ calendarId: z.string().min(1), visible: z.boolean() }))
		.mutation(async ({ ctx, input }) => {
			await ctx.db
				.insert(calendarPreference)
				.values({
					calendarId: input.calendarId,
					userId: ctx.session.user.id,
					visible: input.visible,
				})
				.onConflictDoUpdate({
					target: [calendarPreference.userId, calendarPreference.calendarId],
					set: { updatedAt: sql`(unixepoch())`, visible: input.visible },
				});
			return input;
		}),

	events: protectedProcedure.input(rangeInput).query(({ ctx, input }) =>
		withGoogle(ctx, async (client) => {
			const calendars = (
				await calendarsWithVisibility(ctx, ctx.session.user.id, client)
			).filter((calendar) => calendar.visible);
			const perCalendar = await Promise.all(
				calendars.map(async (calendar) =>
					(await client.listEvents(calendar.id, input)).map(
						(event): CalendarEvent & { color: string } => ({
							...event,
							color: event.color ?? calendar.color,
						})
					)
				)
			);
			return {
				calendars: calendars.map(({ color, id, name }) => ({
					color,
					id,
					name,
				})),
				events: perCalendar.flat(),
			};
		})
	),
});
