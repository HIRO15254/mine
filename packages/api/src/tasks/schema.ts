import { z } from "zod";

import { isDayKey } from "./dates";
import { recurrenceSchema } from "./recurrence";

/**
 * The shapes and limits of a task's fields, for every surface that takes
 * them (the task router and the MCP tools), so a limit is changed once.
 */

/** A calendar day, `YYYY-MM-DD`, that exists. */
export const dayKey = z
	.string()
	.refine(isDayKey, { message: "Expected a date as YYYY-MM-DD" });

/** A time of day, `HH:MM`, 24-hour. */
export const timeOfDay = z
	.string()
	.regex(/^([01]\d|2[0-3]):[0-5]\d$/, { message: "Expected HH:MM" });

export const MAX_TASK_LABELS = 20;

export const taskTitle = z.string().trim().min(1).max(500);
export const taskNote = z.string().max(10_000);
export const taskPriority = z.number().int().min(1).max(4);
export const taskEstimateMinutes = z.number().int().min(1).max(10_000);

/** The fields create and update share; update makes the title optional. */
export const taskFields = {
	deadline: dayKey.nullish(),
	estimateMinutes: taskEstimateMinutes.nullish(),
	labelIds: z.array(z.string().min(1)).max(MAX_TASK_LABELS).optional(),
	note: taskNote.optional(),
	priority: taskPriority.optional(),
	projectId: z.string().min(1).nullish(),
	recurrence: recurrenceSchema.nullish(),
	scheduledDate: dayKey.nullish(),
	scheduledTime: timeOfDay.nullish(),
	startDate: dayKey.nullish(),
	title: taskTitle,
};
