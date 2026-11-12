import { TRPCError } from "@trpc/server";

import { projectPath } from "../projects/tree";
import type { Caller } from "../routers/index";

/**
 * What only `/v1` needs, the small JSON API for third-party apps (HTTP
 * Shortcuts, Tasker, KWGT…). Its timer endpoints are in `time/timer.ts`,
 * shared with the MCP tools.
 */

/** Open projects with their paths, for a picker in a shortcut. */
export async function projectChoices(caller: Caller) {
	const projects = await caller.project.list();
	return projects
		.filter((item) => !item.archived)
		.map((item) => ({
			id: item.id,
			name: item.name,
			path: projectPath(projects, item.id),
		}));
}

/** HTTP status for an error thrown by a procedure. */
export function statusOf(error: unknown): number {
	if (!(error instanceof TRPCError)) {
		return 500;
	}
	const statuses: Partial<Record<TRPCError["code"], number>> = {
		BAD_REQUEST: 400,
		FORBIDDEN: 403,
		NOT_FOUND: 404,
		UNAUTHORIZED: 401,
	};
	return statuses[error.code] ?? 500;
}
