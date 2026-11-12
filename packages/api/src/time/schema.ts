import { z } from "zod";

/**
 * The shapes and limits of time tracking, shared by the time router, the
 * calendar router, `/v1` and the MCP tools.
 */

export const MINUTE = 60_000;
export const DAY = 86_400_000;

/** Longest range a list of entries or events may cover. */
export const MAX_LIST_SPAN = 62 * DAY;
/** Longest range a summary may cover. */
export const MAX_SUMMARY_SPAN = 366 * DAY;
/** Longest a single entry may be, running or not. */
export const MAX_ENTRY_SPAN = 7 * DAY;

/** An instant: epoch milliseconds in UTC. */
export const instant = z.number().int().min(0);

/** What an entry says was done. */
export const entryDescription = z.string().trim().max(500);
