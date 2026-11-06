/** Offset of `timeZone` from UTC at the instant `ms`, in milliseconds. */
export function zoneOffsetMs(ms: number, timeZone: string): number {
	const parts = new Intl.DateTimeFormat("en-US", {
		day: "2-digit",
		hour: "2-digit",
		hourCycle: "h23",
		minute: "2-digit",
		month: "2-digit",
		second: "2-digit",
		timeZone,
		year: "numeric",
	}).formatToParts(new Date(ms));
	const get = (type: Intl.DateTimeFormatPartTypes) =>
		Number(parts.find((part) => part.type === type)?.value);
	const asUtc = Date.UTC(
		get("year"),
		get("month") - 1,
		get("day"),
		get("hour"),
		get("minute"),
		get("second")
	);
	return asUtc - Math.floor(ms / 1000) * 1000;
}

/** The instant a YYYY-MM-DD day starts in `timeZone`. */
export function startOfDayIn(day: string, timeZone: string): number {
	const [year, month, date] = day.split("-").map(Number);
	const guess = Date.UTC(year ?? 1970, (month ?? 1) - 1, date ?? 1);
	const first = guess - zoneOffsetMs(guess, timeZone);
	return guess - zoneOffsetMs(first, timeZone);
}
