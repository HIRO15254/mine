import { z } from "zod";

import { dayKey } from "../tasks/schema";

/**
 * The shapes and limits of an event's fields, for every surface that writes
 * events (the calendar router and the MCP tools).
 */

export const eventTitle = z.string().trim().min(1).max(1024);
export const eventLocation = z.string().trim().max(1024);
export const eventDescription = z.string().max(8000);

/** Longest event Mine writes. */
export const MAX_EVENT_DAYS = 366;
const DAY = 86_400_000;

const instantWithOffset = z.iso.datetime({ offset: true });

/** An IANA zone such as `Asia/Tokyo`. */
export const timeZoneName = z
	.string()
	.min(1)
	.max(64)
	.refine(
		(zone) => {
			try {
				new Intl.DateTimeFormat("en-US", { timeZone: zone });
				return true;
			} catch {
				return false;
			}
		},
		{ message: "Unknown time zone" }
	);

/**
 * When an event happens, as `calendar.events` returns it: days for an
 * all-day event (end exclusive, the day after the last), instants with an
 * offset for a timed one.
 */
export const eventTiming = z
	.discriminatedUnion("allDay", [
		z.object({ allDay: z.literal(true), end: dayKey, start: dayKey }),
		z.object({
			allDay: z.literal(false),
			end: instantWithOffset,
			start: instantWithOffset,
			timeZone: timeZoneName.optional(),
		}),
	])
	.refine(
		(when) => {
			// Days parse as UTC midnights, so their difference is whole days too.
			const span = Date.parse(when.end) - Date.parse(when.start);
			return span > 0 && span <= MAX_EVENT_DAYS * DAY;
		},
		{
			message: `The end must be after the start and within ${MAX_EVENT_DAYS} days`,
		}
	);

export const calendarId = z.string().min(1).max(1024);
export const eventId = z.string().min(1).max(1024);
