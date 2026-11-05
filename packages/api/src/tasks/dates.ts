/** Calendar-day arithmetic on YYYY-MM-DD keys. No time zones involved. */

const DAY_MS = 86_400_000;
const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/;

export function isDayKey(value: string): boolean {
	if (!DAY_KEY.test(value)) {
		return false;
	}
	return toDayKey(fromDayKey(value)) === value;
}

function fromDayKey(key: string): Date {
	return new Date(`${key}T00:00:00Z`);
}

function toDayKey(date: Date): string {
	return date.toISOString().slice(0, 10);
}

export function addDays(key: string, days: number): string {
	return toDayKey(new Date(fromDayKey(key).getTime() + days * DAY_MS));
}

export function diffDays(from: string, to: string): number {
	return Math.round(
		(fromDayKey(to).getTime() - fromDayKey(from).getTime()) / DAY_MS
	);
}

/** 0 = Sunday … 6 = Saturday */
export function weekday(key: string): number {
	return fromDayKey(key).getUTCDay();
}

/** Same day-of-month `months` later, clamped to the month's last day. */
export function addMonths(
	key: string,
	months: number,
	dayOfMonth?: number
): string {
	const date = fromDayKey(key);
	const day = dayOfMonth ?? date.getUTCDate();
	const first = new Date(
		Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1)
	);
	const lastDay = new Date(
		Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)
	).getUTCDate();
	first.setUTCDate(Math.min(day, lastDay));
	return toDayKey(first);
}

export function maxDay(a: string, b: string): string {
	return a > b ? a : b;
}
