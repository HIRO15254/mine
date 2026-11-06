import { TRPCError } from "@trpc/server";
import { z } from "zod";

import type { appRouter } from "../routers/index";

/**
 * A small JSON API for third-party apps (HTTP Shortcuts, Tasker, KWGT…),
 * built on the tRPC procedures so the rules stay in one place.
 */
type Caller = ReturnType<typeof appRouter.createCaller>;
type Project = Awaited<ReturnType<Caller["project"]["list"]>>[number];

const MINUTE = 60_000;

export function formatElapsed(ms: number): string {
	const minutes = Math.max(0, Math.floor(ms / MINUTE));
	return `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, "0")}`;
}

function pathOf(projects: Project[], id: string | null): string | null {
	const byId = new Map(projects.map((p) => [p.id, p]));
	const names: string[] = [];
	let current = id ? byId.get(id) : undefined;
	for (let depth = 0; current && depth < 20; depth += 1) {
		names.unshift(current.name);
		current = current.parentId ? byId.get(current.parentId) : undefined;
	}
	return names.length ? names.join(" / ") : null;
}

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
	const project = pathOf(projects, entry.projectId);
	const ms = now - entry.startedAt;
	const label = entry.description || "説明なし";
	return {
		description: entry.description,
		elapsed: formatElapsed(ms),
		elapsedMinutes: Math.max(0, Math.floor(ms / MINUTE)),
		project,
		running: true,
		startedAt: new Date(entry.startedAt).toISOString(),
		text: `${formatElapsed(ms)} ${label}${project ? `（${project}）` : ""}`,
	};
}

export const startInputSchema = z.object({
	description: z.string().trim().max(500).optional(),
	/** A project's name or its full path such as "大学 / 研究". */
	project: z.string().trim().min(1).optional(),
	projectId: z.string().min(1).optional(),
	taskId: z.string().min(1).optional(),
});

const normalize = (value: string) =>
	value
		.toLowerCase()
		.replaceAll(/\s*\/\s*/g, "/")
		.trim();

export function findProject(
	projects: Project[],
	query: string
): Project | undefined {
	const wanted = normalize(query);
	const open = projects.filter((p) => !p.archived);
	return (
		open.find((p) => normalize(pathOf(projects, p.id) ?? "") === wanted) ??
		open.find((p) => normalize(p.name) === wanted)
	);
}

export async function startTimer(
	caller: Caller,
	input: z.infer<typeof startInputSchema>,
	now: number
): Promise<TimerStatus> {
	let projectId = input.projectId;
	if (input.project && !projectId) {
		const match = findProject(await caller.project.list(), input.project);
		if (!match) {
			throw new TRPCError({
				code: "BAD_REQUEST",
				message: `Unknown project: ${input.project}`,
			});
		}
		projectId = match.id;
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
		text: `停止しました ${formatElapsed(ms)} ${stopped.description || "説明なし"}`,
	};
}

export async function projectChoices(caller: Caller) {
	const projects = await caller.project.list();
	return projects
		.filter((p) => !p.archived)
		.map((p) => ({ id: p.id, name: p.name, path: pathOf(projects, p.id) }));
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
