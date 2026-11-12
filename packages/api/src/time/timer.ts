import { z } from "zod";

import { formatDuration } from "../format";
import { resolveProject } from "../projects/resolve";
import { projectPath } from "../projects/tree";
import type { Caller } from "../routers/index";
import { entryDescription, MINUTE } from "./schema";

/**
 * The timer as `/v1` and the MCP tools use it: by project name instead of
 * id, and answering with a line of text a widget or Claude can show. Built
 * on the tRPC procedures, so the rules stay in one place.
 */

export interface TimerStatus {
	description: string | null;
	elapsed: string | null;
	elapsedMinutes: number;
	project: string | null;
	running: boolean;
	startedAt: string | null;
	/** One line for a widget or toast. */
	text: string;
}

export async function timerStatus(
	caller: Caller,
	now: number
): Promise<TimerStatus> {
	const [entry, projects] = await Promise.all([
		caller.time.current(),
		caller.project.list(),
	]);
	if (!entry) {
		return {
			description: null,
			elapsed: null,
			elapsedMinutes: 0,
			project: null,
			running: false,
			startedAt: null,
			text: "計測していません",
		};
	}
	const project = projectPath(projects, entry.projectId);
	const ms = now - entry.startedAt;
	const label = entry.description || "説明なし";
	return {
		description: entry.description,
		elapsed: formatDuration(ms),
		elapsedMinutes: Math.max(0, Math.floor(ms / MINUTE)),
		project,
		running: true,
		startedAt: new Date(entry.startedAt).toISOString(),
		text: `${formatDuration(ms)} ${label}${project ? `（${project}）` : ""}`,
	};
}

export const startInputSchema = z.object({
	description: entryDescription.optional(),
	/** A project's name or its full path such as "大学 / 研究". */
	project: z.string().trim().min(1).optional(),
	projectId: z.string().min(1).optional(),
	taskId: z.string().min(1).optional(),
});

export async function startTimer(
	caller: Caller,
	input: z.infer<typeof startInputSchema>,
	now: number
): Promise<TimerStatus> {
	let projectId = input.projectId;
	if (input.project && !projectId) {
		projectId = resolveProject(await caller.project.list(), input.project).id;
	}
	await caller.time.start({
		description: input.description,
		projectId,
		taskId: input.taskId,
	});
	return timerStatus(caller, now);
}

export async function stopTimer(caller: Caller) {
	const stopped = await caller.time.stop();
	if (!stopped) {
		return { stopped: false, text: "計測していません" };
	}
	const ms = (stopped.endedAt ?? stopped.startedAt) - stopped.startedAt;
	return {
		durationMinutes: Math.floor(ms / MINUTE),
		stopped: true,
		text: `停止しました ${formatDuration(ms)} ${stopped.description || "説明なし"}`,
	};
}
