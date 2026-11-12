import {
	type QueryClient,
	type QueryKey,
	useMutation,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";
import { TRPCClientError } from "@trpc/client";
import { toast } from "sonner";

import type { DisplayEvent, TimedRange } from "@/lib/calendar-time";
import { trpc } from "@/lib/trpc";

import { connectGoogle, isCalendarNotConnected } from "./calendar-status";
import type { EventTiming } from "./event-draft";

type EventsData = { events: DisplayEvent[] } & Record<string, unknown>;
type Snapshot = [QueryKey, EventsData | undefined][];

export function useCalendarEvents(range: TimedRange) {
	return useQuery({
		...trpc.calendar.events.queryOptions(range),
		retry: false,
		staleTime: 60_000,
	});
}

/** The calendars events can be added to, the primary one first. */
export function useWritableCalendars() {
	const calendars = useQuery({
		...trpc.calendar.calendars.queryOptions(),
		retry: false,
		staleTime: 5 * 60_000,
	});
	return (calendars.data ?? []).filter((calendar) => calendar.writable);
}

/** What went wrong with a change to an event, in the person's words. */
export function eventErrorMessage(error: unknown): string {
	if (isCalendarNotConnected(error)) {
		return "予定を編集するには、Google カレンダーとの連携をやり直してください";
	}
	if (error instanceof TRPCClientError) {
		if (error.data?.code === "FORBIDDEN") {
			return "このカレンダーの予定は変更できません";
		}
		if (error.data?.code === "NOT_FOUND") {
			return "予定が見つかりませんでした。削除された可能性があります";
		}
	}
	return "予定を保存できませんでした";
}

/** A toast that says what went wrong, with a way to reconnect when that helps. */
export function toastEventError(error: unknown): void {
	toast.error(
		eventErrorMessage(error),
		isCalendarNotConnected(error)
			? { action: { label: "連携", onClick: () => connectGoogle() } }
			: undefined
	);
}

const eventsKey = () => trpc.calendar.events.pathKey();

async function snapshotEvents(queryClient: QueryClient): Promise<Snapshot> {
	await queryClient.cancelQueries({ queryKey: eventsKey() });
	return queryClient.getQueriesData<EventsData>({ queryKey: eventsKey() });
}

function restoreEvents(queryClient: QueryClient, snapshot?: Snapshot) {
	for (const [key, data] of snapshot ?? []) {
		queryClient.setQueryData(key, data);
	}
}

function editEvents(
	queryClient: QueryClient,
	edit: (events: DisplayEvent[]) => DisplayEvent[]
) {
	queryClient.setQueriesData<EventsData>({ queryKey: eventsKey() }, (data) =>
		data ? { ...data, events: edit(data.events) } : data
	);
}

const sameEvent =
	(calendarId: string, eventId: string) => (event: DisplayEvent) =>
		event.calendarId === calendarId && event.id === eventId;

export function useInvalidateEvents() {
	const queryClient = useQueryClient();
	return () => queryClient.invalidateQueries({ queryKey: eventsKey() });
}

export function useCreateEvent(options: {
	onError?: (error: unknown) => void;
}) {
	const invalidate = useInvalidateEvents();
	return useMutation(
		trpc.calendar.createEvent.mutationOptions({
			onError: options.onError ?? toastEventError,
			onSettled: invalidate,
		})
	);
}

/**
 * Changes an event on screen at once (a drag must not jump back while the
 * request runs) and puts it back if Google refuses.
 */
export function useUpdateEvent(
	options: { onError?: (error: unknown) => void } = {}
) {
	const queryClient = useQueryClient();
	const invalidate = useInvalidateEvents();
	return useMutation(
		trpc.calendar.updateEvent.mutationOptions({
			onMutate: async (input) => {
				const snapshot = await snapshotEvents(queryClient);
				const matches = sameEvent(input.calendarId, input.eventId);
				editEvents(queryClient, (events) =>
					events.map((event) =>
						matches(event) ? changed(event, input) : event
					)
				);
				return { snapshot };
			},
			onError: (error, _input, context) => {
				restoreEvents(queryClient, context?.snapshot);
				(options.onError ?? toastEventError)(error);
			},
			onSettled: invalidate,
		})
	);
}

/** The event as it will be once Google has the change. */
function changed(
	event: DisplayEvent,
	input: {
		description?: string | null;
		location?: string | null;
		title?: string;
		when?: EventTiming;
	}
): DisplayEvent {
	const next = { ...event };
	if (input.title !== undefined) {
		next.title = input.title;
	}
	if (input.location !== undefined) {
		next.location = input.location;
	}
	if (input.description !== undefined) {
		next.description = input.description;
	}
	if (input.when) {
		next.allDay = input.when.allDay;
		next.start = input.when.start;
		next.end = input.when.end;
	}
	return next;
}

export function useDeleteEvent(
	options: { onError?: (error: unknown) => void } = {}
) {
	const queryClient = useQueryClient();
	const invalidate = useInvalidateEvents();
	return useMutation(
		trpc.calendar.deleteEvent.mutationOptions({
			onMutate: async (input) => {
				const snapshot = await snapshotEvents(queryClient);
				const matches = sameEvent(input.calendarId, input.eventId);
				editEvents(queryClient, (events) =>
					events.filter((event) => !matches(event))
				);
				return { snapshot };
			},
			onError: (error, _input, context) => {
				restoreEvents(queryClient, context?.snapshot);
				(options.onError ?? toastEventError)(error);
			},
			onSettled: invalidate,
		})
	);
}
