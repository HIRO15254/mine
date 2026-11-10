export type FetchLike = (
	input: RequestInfo | URL,
	init?: RequestInit
) => Promise<Response>;

const API_BASE = "https://www.googleapis.com/calendar/v3";
const INSUFFICIENT_SCOPE = /insufficient/i;

/** Google rejected the token: not linked, expired, or missing the calendar scope. */
export class GoogleCalendarAuthError extends Error {
	constructor(message = "Google Calendar access is not authorized") {
		super(message);
		this.name = "GoogleCalendarAuthError";
	}
}

export interface GoogleCalendar {
	color: string;
	id: string;
	name: string;
	primary: boolean;
	selected: boolean;
}

export interface CalendarEvent {
	allDay: boolean;
	calendarId: string;
	/** The event's own color, when it has one; otherwise its calendar's. */
	color?: string;
	/** Exclusive end: an ISO date-time, or YYYY-MM-DD for all-day events. */
	end: string;
	htmlLink: string | null;
	id: string;
	location: string | null;
	/** An ISO date-time, or YYYY-MM-DD for all-day events. */
	start: string;
	title: string;
}

export interface TimeRange {
	timeMax: string;
	timeMin: string;
}

interface CalendarListResponse {
	items?: Array<{
		backgroundColor?: string;
		id: string;
		primary?: boolean;
		selected?: boolean;
		summary?: string;
		summaryOverride?: string;
	}>;
	nextPageToken?: string;
}

interface EventDateTime {
	date?: string;
	dateTime?: string;
}

interface EventsResponse {
	items?: Array<{
		colorId?: string;
		end?: EventDateTime;
		htmlLink?: string;
		id: string;
		location?: string;
		start?: EventDateTime;
		status?: string;
		summary?: string;
	}>;
	nextPageToken?: string;
}

const DEFAULT_COLOR = "#4285f4";

/**
 * Event colors as Google Calendar draws them today (Lavender … Tomato). The
 * API's /colors endpoint still serves the older, paler palette.
 */
const EVENT_COLORS: Record<string, string> = {
	"1": "#7986cb",
	"2": "#33b679",
	"3": "#8e24aa",
	"4": "#e67c73",
	"5": "#f6bf26",
	"6": "#f4511e",
	"7": "#039be5",
	"8": "#616161",
	"9": "#3f51b5",
	"10": "#0b8043",
	"11": "#d50000",
};

export function createGoogleCalendarClient(
	accessToken: string,
	fetchFn: FetchLike = (input, init) => fetch(input, init)
) {
	async function request<T>(
		path: string,
		params: Record<string, string>
	): Promise<T> {
		const url = new URL(`${API_BASE}${path}`);
		for (const [key, value] of Object.entries(params)) {
			url.searchParams.set(key, value);
		}
		const response = await fetchFn(url, {
			headers: { Authorization: `Bearer ${accessToken}` },
		});
		if (response.status === 401) {
			throw new GoogleCalendarAuthError();
		}
		if (response.status === 403) {
			const body = await response.text();
			if (INSUFFICIENT_SCOPE.test(body)) {
				throw new GoogleCalendarAuthError();
			}
			throw new Error(`Google Calendar request failed with 403: ${body}`);
		}
		if (!response.ok) {
			throw new Error(`Google Calendar request failed with ${response.status}`);
		}
		return (await response.json()) as T;
	}

	async function listCalendars(): Promise<GoogleCalendar[]> {
		const calendars: GoogleCalendar[] = [];
		let pageToken: string | undefined;
		do {
			const page: CalendarListResponse = await request(
				"/users/me/calendarList",
				{
					maxResults: "250",
					...(pageToken ? { pageToken } : {}),
				}
			);
			for (const item of page.items ?? []) {
				calendars.push({
					color: item.backgroundColor ?? DEFAULT_COLOR,
					id: item.id,
					name: item.summaryOverride ?? item.summary ?? item.id,
					primary: item.primary === true,
					selected: item.selected === true,
				});
			}
			pageToken = page.nextPageToken;
		} while (pageToken);
		return calendars;
	}

	async function listEvents(
		calendarId: string,
		range: TimeRange
	): Promise<CalendarEvent[]> {
		const events: CalendarEvent[] = [];
		let pageToken: string | undefined;
		do {
			const page: EventsResponse = await request(
				`/calendars/${encodeURIComponent(calendarId)}/events`,
				{
					maxResults: "2500",
					orderBy: "startTime",
					singleEvents: "true",
					timeMax: range.timeMax,
					timeMin: range.timeMin,
					...(pageToken ? { pageToken } : {}),
				}
			);
			for (const item of page.items ?? []) {
				const event = toCalendarEvent(calendarId, item);
				if (event) {
					events.push(event);
				}
			}
			pageToken = page.nextPageToken;
		} while (pageToken);
		return events;
	}

	return { listCalendars, listEvents };
}

export type GoogleCalendarClient = ReturnType<
	typeof createGoogleCalendarClient
>;

function toCalendarEvent(
	calendarId: string,
	item: NonNullable<EventsResponse["items"]>[number]
): CalendarEvent | null {
	if (item.status === "cancelled") {
		return null;
	}
	const start = item.start?.dateTime ?? item.start?.date;
	const end = item.end?.dateTime ?? item.end?.date;
	if (!(start && end)) {
		return null;
	}
	const color = item.colorId ? EVENT_COLORS[item.colorId] : undefined;
	return {
		allDay: item.start?.dateTime === undefined,
		calendarId,
		...(color ? { color } : {}),
		end,
		htmlLink: item.htmlLink ?? null,
		id: item.id,
		location: item.location ?? null,
		start,
		title: item.summary ?? "",
	};
}
