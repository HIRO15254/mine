import type { RouterOutputs } from "@mine/api/routers/index";

import { formatClock } from "./calendar-time";

export type ClaudeThread = RouterOutputs["thread"]["list"][number];

export const THREAD_STATUS_LABEL: Record<ClaudeThread["status"], string> = {
	done: "完了",
	waiting: "あなた待ち",
	working: "作業中",
};

const STATUS_ORDER: Record<ClaudeThread["status"], number> = {
	done: 2,
	waiting: 0,
	working: 1,
};

/** Threads waiting for the user first, then the newest. */
export function sortThreads(threads: ClaudeThread[]): ClaudeThread[] {
	return [...threads].sort(
		(a, b) =>
			STATUS_ORDER[a.status] - STATUS_ORDER[b.status] ||
			b.updatedAt - a.updatedAt
	);
}

/** 10:05 for today, 11/5 10:05 for an earlier day. */
export function formatUpdated(ms: number, now: number): string {
	const date = new Date(ms);
	const today = new Date(now);
	const sameDay =
		date.getFullYear() === today.getFullYear() &&
		date.getMonth() === today.getMonth() &&
		date.getDate() === today.getDate();
	return sameDay
		? formatClock(ms)
		: `${date.getMonth() + 1}/${date.getDate()} ${formatClock(ms)}`;
}
