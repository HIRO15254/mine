import { CLAUDE_THREAD_STATUSES } from "@mine/db/schema/claude";
import { z } from "zod";

/** Only https links, so a report can never smuggle in a script URL. */
export const threadUrl = z
	.string()
	.trim()
	.max(2000)
	.url()
	.refine((value) => new URL(value).protocol === "https:", {
		message: "Expected an https URL",
	});

/** What a Claude thread reports about itself, over tRPC or MCP. */
export const threadFields = {
	id: z.string().min(1).optional(),
	nextAction: z.string().trim().max(1000).optional(),
	status: z.enum(CLAUDE_THREAD_STATUSES),
	summary: z.string().trim().max(2000).optional(),
	title: z.string().trim().min(1).max(200),
	url: threadUrl.optional(),
};
