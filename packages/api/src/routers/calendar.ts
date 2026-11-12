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
	GoogleCalendarForbiddenError,
	GoogleCalendarNotFoundError,
} from "../google/calendar";
import {
	calendarId,
	eventDescription,
	eventId,
	eventLocation,
	eventTiming,
	eventTitle,
} from "../google/schema";
import { protectedProcedure, router } from "../index";
import { MAX_LIST_SPAN } from "../time/schema";

/** Shown to the web client so it can offer to reconnect Google. */
export const CALENDAR_NOT_CONNECTED = "GOOGLE_CALENDAR_NOT_CONNECTED";

const rangeInput = z
	.object({
		timeMax: z.iso.datetime({ offset: true }),
		timeMin: z.iso.datetime({ offset: true }),
	})
	.refine(
		(range) => {
			const span = Date.parse(range.timeMax) - Date.parse(range.timeMin);
			return span > 0 && span <= MAX_LIST_SPAN;
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
		if (error instanceof GoogleCalendarForbiddenError) {
			throw new TRPCError({
				code: "FORBIDDEN",
				message: "This calendar or event cannot be changed",
			});
		}
		if (error instanceof GoogleCalendarNotFoundError) {
			throw new TRPCError({ code: "NOT_FOUND", message: "Event not found" });
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
			writable: calendar.writable,
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
				calendars: calendars.map(({ color, id, name, writable }) => ({
					color,
					id,
					name,
					writable,
				})),
				events: perCalendar.flat(),
			};
		})
	),

	/** Adds an event to one of the user's writable calendars. */
	createEvent: protectedProcedure
		.input(
			z.object({
				calendarId,
				description: eventDescription.nullish(),
				location: eventLocation.nullish(),
				title: eventTitle,
				when: eventTiming,
			})
		)
		.mutation(({ ctx, input }) =>
			withGoogle(ctx, (client) =>
				client.insertEvent(input.calendarId, {
					description: input.description ?? null,
					location: input.location ?? null,
					title: input.title,
					when: input.when,
				})
			)
		),

	/**
	 * Changes an event. Fields left out stay as they are; one occurrence of a
	 * repeating event changes only that occurrence.
	 */
	updateEvent: protectedProcedure
		.input(
			z.object({
				calendarId,
				description: eventDescription.nullish(),
				eventId,
				location: eventLocation.nullish(),
				title: eventTitle.optional(),
				when: eventTiming.optional(),
			})
		)
		.mutation(({ ctx, input }) => {
			const { calendarId: calendar, eventId: event, ...changes } = input;
			return withGoogle(ctx, (client) =>
				client.patchEvent(calendar, event, changes)
			);
		}),

	deleteEvent: protectedProcedure
		.input(z.object({ calendarId, eventId }))
		.mutation(({ ctx, input }) =>
			withGoogle(ctx, async (client) => {
				await client.deleteEvent(input.calendarId, input.eventId);
				return { calendarId: input.calendarId, eventId: input.eventId };
			})
		),
});
