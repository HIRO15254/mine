export type FetchLike = (
	input: RequestInfo | URL,
	init?: RequestInit
) => Promise<Response>;

const API_BASE = "https://www.googleapis.com/calendar/v3";
const INSUFFICIENT_SCOPE = /insufficient/i;
/** A calendar the user may only read, or an event only its organizer may change. */
const NO_WRITE_ACCESS =
	/requiredAccessLevel|forbiddenForNonOrganizer|"forbidden"/;

/** Google rejected the token: not linked, expired, or missing the calendar scope. */
export class GoogleCalendarAuthError extends Error {
	constructor(message = "Google Calendar access is not authorized") {
		super(message);
		this.name = "GoogleCalendarAuthError";
	}
}

/** Google refused a change: the calendar or the event is read-only to the user. */
export class GoogleCalendarForbiddenError extends Error {
	constructor(message = "Google Calendar refused the change") {
		super(message);
		this.name = "GoogleCalendarForbiddenError";
	}
}

/** The event or calendar does not exist (or was deleted). */
export class GoogleCalendarNotFoundError extends Error {
	constructor(message = "Google Calendar event not found") {
		super(message);
		this.name = "GoogleCalendarNotFoundError";
	}
}

export interface GoogleCalendar {
	color: string;
	id: string;
	name: string;
	primary: boolean;
	selected: boolean;
	/** The user may add and change events (owner or writer). */
	writable: boolean;
}

export interface CalendarEvent {
	allDay: boolean;
	calendarId: string;
	/** The event's own color, when it has one; otherwise its calendar's. */
	color?: string;
	description: string | null;
	/** Exclusive end: an ISO date-time, or YYYY-MM-DD for all-day events. */
	end: string;
	htmlLink: string | null;
	id: string;
	location: string | null;
	/** One occurrence of a repeating event; a change touches only this one. */
	recurring: boolean;
	/** An ISO date-time, or YYYY-MM-DD for all-day events. */
	start: string;
	title: string;
}

/** When an event happens, in the shape `CalendarEvent` reads. */
export interface EventTiming {
	allDay: boolean;
	/** Exclusive: the day after the last for all-day events. */
	end: string;
	start: string;
	/** IANA zone Google stores with a timed event. */
	timeZone?: string;
}

/** What Mine writes on an event. Leaving a field out keeps it. */
export interface EventChanges {
	description?: string | null;
	location?: string | null;
	title?: string;
	when?: EventTiming;
}

export interface TimeRange {
	timeMax: string;
	timeMin: string;
}

interface CalendarListResponse {
	items?: Array<{
		accessRole?: string;
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
	date?: string | null;
	dateTime?: string | null;
}

interface GoogleEvent {
	colorId?: string;
	description?: string;
	end?: EventDateTime;
	htmlLink?: string;
	id: string;
	location?: string;
	recurringEventId?: string;
	start?: EventDateTime;
	status?: string;
	summary?: string;
}

interface EventsResponse {
	items?: GoogleEvent[];
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

/** The error a refused request stands for. */
async function failure(response: Response): Promise<Error> {
	if (response.status === 401) {
		return new GoogleCalendarAuthError();
	}
	if (response.status === 403) {
		const body = await response.text();
		if (INSUFFICIENT_SCOPE.test(body)) {
			return new GoogleCalendarAuthError();
		}
		if (NO_WRITE_ACCESS.test(body)) {
			return new GoogleCalendarForbiddenError();
		}
		return new Error(`Google Calendar request failed with 403: ${body}`);
	}
	// Google answers 410 for an event that was already deleted.
	if (response.status === 404 || response.status === 410) {
		return new GoogleCalendarNotFoundError();
	}
	return new Error(`Google Calendar request failed with ${response.status}`);
}

export function createGoogleCalendarClient(
	accessToken: string,
	fetchFn: FetchLike = (input, init) => fetch(input, init)
) {
	async function send(
		path: string,
		params: Record<string, string>,
		init: { body?: unknown; method?: "DELETE" | "GET" | "PATCH" | "POST" } = {}
	): Promise<Response> {
		const url = new URL(`${API_BASE}${path}`);
		for (const [key, value] of Object.entries(params)) {
			url.searchParams.set(key, value);
		}
		const response = await fetchFn(url, {
			headers: {
				Authorization: `Bearer ${accessToken}`,
				...(init.body === undefined
					? {}
					: { "Content-Type": "application/json" }),
			},
			...(init.method ? { method: init.method } : {}),
			...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
		});
		if (!response.ok) {
			throw await failure(response);
		}
		return response;
	}

	async function request<T>(
		path: string,
		params: Record<string, string>
	): Promise<T> {
		return (await (await send(path, params)).json()) as T;
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
					writable: item.accessRole === "owner" || item.accessRole === "writer",
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

	const eventsPath = (calendarId: string) =>
		`/calendars/${encodeURIComponent(calendarId)}/events`;

	async function insertEvent(
		calendarId: string,
		changes: EventChanges & { title: string; when: EventTiming }
	): Promise<CalendarEvent> {
		const response = await send(
			eventsPath(calendarId),
			{},
			{ body: toGoogleBody(changes), method: "POST" }
		);
		return toWrittenEvent(calendarId, (await response.json()) as GoogleEvent);
	}

	async function patchEvent(
		calendarId: string,
		eventId: string,
		changes: EventChanges
	): Promise<CalendarEvent> {
		const response = await send(
			`${eventsPath(calendarId)}/${encodeURIComponent(eventId)}`,
			{},
			{ body: toGoogleBody(changes), method: "PATCH" }
		);
		return toWrittenEvent(calendarId, (await response.json()) as GoogleEvent);
	}

	async function deleteEvent(
		calendarId: string,
		eventId: string
	): Promise<void> {
		await send(
			`${eventsPath(calendarId)}/${encodeURIComponent(eventId)}`,
			{},
			{ method: "DELETE" }
		);
	}

	return { deleteEvent, insertEvent, listCalendars, listEvents, patchEvent };
}

/**
 * The PATCH or POST body. Switching between all-day and timed clears the
 * other field, since a patch merges `start` and `end` with what is stored.
 */
function toGoogleBody(changes: EventChanges): Record<string, unknown> {
	const body: Record<string, unknown> = {};
	if (changes.title !== undefined) {
		body.summary = changes.title;
	}
	if (changes.location !== undefined) {
		body.location = changes.location ?? "";
	}
	if (changes.description !== undefined) {
		body.description = changes.description ?? "";
	}
	if (changes.when) {
		const { allDay, end, start, timeZone } = changes.when;
		const edge = (value: string) =>
			allDay
				? { date: value, dateTime: null }
				: {
						date: null,
						dateTime: value,
						...(timeZone ? { timeZone } : {}),
					};
		body.start = edge(start);
		body.end = edge(end);
	}
	return body;
}

function toWrittenEvent(calendarId: string, item: GoogleEvent): CalendarEvent {
	const event = toCalendarEvent(calendarId, item);
	if (!event) {
		throw new Error("Google Calendar returned an event without times");
	}
	return event;
}

export type GoogleCalendarClient = ReturnType<
	typeof createGoogleCalendarClient
>;

function toCalendarEvent(
	calendarId: string,
	item: GoogleEvent
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
		allDay: !item.start?.dateTime,
		calendarId,
		...(color ? { color } : {}),
		description: item.description || null,
		end,
		htmlLink: item.htmlLink ?? null,
		id: item.id,
		location: item.location || null,
		recurring: item.recurringEventId !== undefined,
		start,
		title: item.summary ?? "",
	};
}
