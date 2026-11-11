/**
 * The one-line timer entry: "論文を読む #研究" starts "論文を読む" on the
 * project 研究. Suggestions come from open tasks, past entries and the
 * calendar events happening around now.
 */
import type { DisplayEvent } from "./calendar-time";
import type { Project, Task } from "./tasks";
import type { TimeEntry } from "./time";

const lower = (value: string) => value.toLocaleLowerCase("ja");

export interface HashToken {
	end: number;
	project: Project | null;
	start: number;
}

const HASH = /#[^\s#]+/g;
const SPACE = /\s/;
const SPACES = /\s+/g;
const LEADING_SPACE = /^\s+/;

/**
 * The project a name stands for. Several can share a name (under different
 * parents): the one picked from the suggestions wins, then an open one.
 */
function findProject(
	projects: Project[],
	name: string,
	preferredId?: string | null
): Project | null {
	const wanted = lower(name);
	const named = projects.filter((item) => lower(item.name) === wanted);
	return (
		named.find((item) => item.id === preferredId) ??
		named.find((item) => !item.archived) ??
		named[0] ??
		null
	);
}

/** The project name with spaces that the text after a "#" starts with. */
function spacedName(rest: string, names: string[]): string | undefined {
	const text = lower(rest);
	return names.find(
		(name) =>
			text.startsWith(name) &&
			(text.length === name.length || SPACE.test(text[name.length] ?? ""))
	);
}

/**
 * Every "#word" that starts a word, with the project it names, if any. A
 * project whose name has spaces is matched whole ("#Side project").
 */
export function findHashTokens(
	text: string,
	projects: Project[],
	preferredId?: string | null
): HashToken[] {
	const tokens: HashToken[] = [];
	// Longest first, so "#Side project" is not read as "#Side".
	const spaced = [...new Set(projects.map((item) => lower(item.name)))]
		.filter((name) => SPACE.test(name))
		.sort((a, b) => b.length - a.length);
	let covered = 0;
	for (const match of text.matchAll(HASH)) {
		const start = match.index;
		if (start < covered || (start > 0 && !SPACE.test(text[start - 1] ?? ""))) {
			continue;
		}
		const long = spacedName(text.slice(start + 1), spaced);
		const name = long
			? text.slice(start + 1, start + 1 + long.length)
			: match[0].slice(1);
		covered = start + 1 + name.length;
		tokens.push({
			end: covered,
			project: findProject(projects, name, preferredId),
			start,
		});
	}
	return tokens;
}

/**
 * The description without project tokens, and the last project named.
 * `preferredId` is the project picked from the suggestions, which settles a
 * name that several projects share.
 */
export function parseTimerText(
	text: string,
	projects: Project[],
	preferredId?: string | null
): { description: string; projectId: string | null } {
	let projectId: string | null = null;
	let description = "";
	let from = 0;
	for (const token of findHashTokens(text, projects, preferredId)) {
		if (!token.project) {
			continue;
		}
		projectId = token.project.id;
		description += text.slice(from, token.start);
		from = token.end;
	}
	description += text.slice(from);
	return { description: description.replace(SPACES, " ").trim(), projectId };
}

/** The "#word" the caret is in or right after, while it is being typed. */
export function hashAtCaret(
	text: string,
	caret: number
): { end: number; query: string; start: number } | null {
	let start = caret;
	while (start > 0 && !SPACE.test(text[start - 1] ?? "")) {
		start -= 1;
	}
	if (text[start] !== "#") {
		return null;
	}
	let end = caret;
	while (end < text.length && !SPACE.test(text[end] ?? "")) {
		end += 1;
	}
	return { end, query: text.slice(start + 1, caret), start };
}

/** Replaces the token being typed with "#name " and returns the new caret. */
export function completeHash(
	text: string,
	token: { end: number; start: number },
	project: Project
): { caret: number; text: string } {
	const inserted = `#${project.name} `;
	const rest = text.slice(token.end).replace(LEADING_SPACE, "");
	return {
		caret: token.start + inserted.length,
		text: text.slice(0, token.start) + inserted + rest,
	};
}

/** The text that starts `description` on `projectId`. */
export function timerText(
	description: string,
	projectId: string | null,
	projects: Project[]
): string {
	const project = projects.find((item) => item.id === projectId);
	return project ? `${description} #${project.name}` : description;
}

export type SuggestionKind = "event" | "entry" | "project" | "task";

export interface TimerSuggestion {
	description: string;
	key: string;
	kind: SuggestionKind;
	/** "16:30–18:00" for an event. */
	note?: string;
	projectId: string | null;
	taskId: string | null;
}

const MAX_SUGGESTIONS = 7;
const EVENT_LEAD = 15 * 60_000;
const EVENT_AHEAD = 60 * 60_000;

const clock = new Intl.DateTimeFormat("ja-JP", {
	hour: "2-digit",
	minute: "2-digit",
});

/** Timed events running now, about to start, or starting within the hour. */
export function eventsAroundNow(
	events: DisplayEvent[],
	now: number
): DisplayEvent[] {
	return events
		.filter((event) => {
			if (event.allDay || !event.title) {
				return false;
			}
			const start = Date.parse(event.start);
			const end = Date.parse(event.end);
			return end > now && start - EVENT_AHEAD <= now;
		})
		.sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
}

function eventSuggestion(event: DisplayEvent, now: number): TimerSuggestion {
	const start = Date.parse(event.start);
	const end = Date.parse(event.end);
	const running = start - EVENT_LEAD <= now;
	return {
		description: event.title,
		key: `event:${event.calendarId}:${event.id}`,
		kind: "event",
		note: running
			? `${clock.format(start)}–${clock.format(end)}`
			: `${clock.format(start)} から`,
		projectId: null,
		taskId: null,
	};
}

/** Past entries, newest first, one per description and project. */
function distinctEntries(entries: TimeEntry[]): TimeEntry[] {
	const seen = new Set<string>();
	const result: TimeEntry[] = [];
	for (const entry of [...entries].sort((a, b) => b.startedAt - a.startedAt)) {
		const key = `${lower(entry.description)}\u0000${entry.projectId ?? ""}`;
		if (!entry.description || seen.has(key)) {
			continue;
		}
		seen.add(key);
		result.push(entry);
	}
	return result;
}

function entrySuggestion(entry: TimeEntry): TimerSuggestion {
	return {
		description: entry.description,
		key: `entry:${entry.id}`,
		kind: "entry",
		projectId: entry.projectId,
		taskId: entry.taskId,
	};
}

function taskSuggestion(task: Task): TimerSuggestion {
	return {
		description: task.title,
		key: `task:${task.id}`,
		kind: "task",
		projectId: task.projectId,
		taskId: task.id,
	};
}

/**
 * What to offer under the timer entry. While a "#word" is being typed, the
 * matching projects. With nothing typed, the events around now and the most
 * recent entries. Otherwise tasks, past entries and events that contain the
 * text.
 */
export function suggestTimer({
	caret,
	entries,
	events,
	now,
	projects,
	tasks,
	text,
}: {
	caret: number;
	entries: TimeEntry[];
	events: DisplayEvent[];
	now: number;
	projects: Project[];
	tasks: Task[];
	text: string;
}): TimerSuggestion[] {
	const hash = hashAtCaret(text, caret);
	if (hash) {
		const query = lower(hash.query);
		return projects
			.filter((item) => !item.archived && lower(item.name).includes(query))
			.sort(
				(a, b) =>
					Number(!lower(a.name).startsWith(query)) -
					Number(!lower(b.name).startsWith(query))
			)
			.slice(0, MAX_SUGGESTIONS)
			.map((item) => ({
				description: item.name,
				key: `project:${item.id}`,
				kind: "project",
				projectId: item.id,
				taskId: null,
			}));
	}

	const { description } = parseTimerText(text, projects);
	const query = lower(description);
	const around = eventsAroundNow(events, now).map((event) =>
		eventSuggestion(event, now)
	);
	const recent = distinctEntries(entries).map(entrySuggestion);
	if (!query) {
		return [...around, ...recent.slice(0, 3)].slice(0, MAX_SUGGESTIONS);
	}

	const matches = (value: string) =>
		lower(value).includes(query) && lower(value) !== query;
	const result: TimerSuggestion[] = [];
	const seen = new Set<string>();
	const add = (items: TimerSuggestion[], limit: number) => {
		let added = 0;
		for (const item of items) {
			const key = lower(item.description);
			if (added >= limit || seen.has(key) || !matches(item.description)) {
				continue;
			}
			seen.add(key);
			result.push(item);
			added += 1;
		}
	};
	add(around, 2);
	add(tasks.map(taskSuggestion), 4);
	add(recent, 4);
	const dayEvents = events
		.filter((event) => !event.allDay)
		.map((event) => eventSuggestion(event, now));
	add(dayEvents, 2);
	return result.slice(0, MAX_SUGGESTIONS);
}

/** An entry that overlaps an event this long has recorded it. */
const COVERED = 10 * 60_000;

export interface UnrecordedEvent {
	event: DisplayEvent;
	/** Where recording it starts: the event's start, or the end of a short overlap. */
	from: number;
	/** The project its title was last recorded on. */
	projectId: string | null;
}

/**
 * The timed event under way now that no entry has recorded yet: none shares
 * its title and none overlaps it for 10 minutes or more. When several run at
 * once, the one that started last.
 */
export function unrecordedEvent({
	entries,
	events,
	now,
}: {
	entries: TimeEntry[];
	events: DisplayEvent[];
	now: number;
}): UnrecordedEvent | null {
	const running = events
		.filter((event) => {
			if (event.allDay || !event.title) {
				return false;
			}
			return Date.parse(event.start) <= now && Date.parse(event.end) > now;
		})
		.sort((a, b) => Date.parse(b.start) - Date.parse(a.start));
	for (const event of running) {
		const start = Date.parse(event.start);
		const title = lower(event.title);
		let from = start;
		let covered = false;
		for (const entry of entries) {
			const overlap =
				Math.min(entry.endedAt ?? now, now) - Math.max(entry.startedAt, start);
			if (overlap <= 0) {
				continue;
			}
			if (lower(entry.description) === title || overlap >= COVERED) {
				covered = true;
				break;
			}
			from = Math.max(from, entry.endedAt ?? now);
		}
		if (!covered) {
			const past = distinctEntries(entries).find(
				(entry) => lower(entry.description) === title
			);
			return { event, from, projectId: past?.projectId ?? null };
		}
	}
	return null;
}
