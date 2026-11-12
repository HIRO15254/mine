import { MINUTE } from "./time/schema";

/**
 * Text for the surfaces that answer in words (`/v1` and MCP). The web app
 * formats for itself, in the browser's locale and time zone.
 */

/** "1:05" for an hour and five minutes; seconds are dropped. */
export function formatDuration(ms: number): string {
	const minutes = Math.max(0, Math.floor(ms / MINUTE));
	return `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, "0")}`;
}

/** "2026-11-06 10:00": an instant on the wall clock of `timeZone`. */
export function formatLocalTime(ms: number, timeZone: string): string {
	return new Intl.DateTimeFormat("sv-SE", {
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		month: "2-digit",
		timeZone,
		year: "numeric",
	}).format(new Date(ms));
}
