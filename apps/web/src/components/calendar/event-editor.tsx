import { IconExternalLink, IconRepeat } from "@tabler/icons-react";
import { type FormEvent, useId, useState } from "react";
import { toast } from "sonner";

import { FormSheet } from "@/components/form-sheet/form-sheet";
import { useSheetState } from "@/components/form-sheet/use-sheet-state";
import { ConfirmDeleteButton } from "@/components/tasks/confirm-delete-button";
import { Button, buttonVariants } from "@/components/ui/button/button";
import { Field, FieldError } from "@/components/ui/field/field";
import { Input } from "@/components/ui/input/input";
import { NativeSelect } from "@/components/ui/native-select/native-select";
import { Switch } from "@/components/ui/switch/switch";
import { Textarea } from "@/components/ui/textarea/textarea";
import { useControlSize } from "@/hooks/use-media-query";
import type { DisplayEvent } from "@/lib/calendar-time";
import { currentTimeZone } from "@/lib/time";
import { cn } from "@/lib/utils";

import { connectGoogle, isCalendarNotConnected } from "./calendar-status";
import {
	draftFromEvent,
	type EventDraft,
	type EventSeed,
	eventFields,
	moveStart,
} from "./event-draft";
import {
	eventErrorMessage,
	useCreateEvent,
	useDeleteEvent,
	useUpdateEvent,
	useWritableCalendars,
} from "./use-events";

type Calendar = ReturnType<typeof useWritableCalendars>[number];

interface Opened {
	event: DisplayEvent | null;
	seed: EventSeed;
}

/**
 * Owns the event editor's open state; render `editor` once per page.
 * `openNew` starts a new event, `openEvent` changes one.
 */
export function useEventEditor() {
	const calendars = useWritableCalendars();
	const defaultCalendar = calendars[0]?.id ?? "primary";
	const sheet = useSheetState<Opened>({
		event: null,
		seed: { allDay: false, calendarId: defaultCalendar, day: "" },
	});
	const editor = (
		<EventEditor
			calendars={calendars}
			event={sheet.value.event}
			key={sheet.key}
			onOpenChange={sheet.setOpen}
			open={sheet.open}
			seed={sheet.value.seed}
		/>
	);
	return {
		/** Whether an event's calendar takes changes from Mine. */
		canEdit: (event: DisplayEvent) =>
			calendars.some((calendar) => calendar.id === event.calendarId),
		editor,
		openEvent: (event: DisplayEvent) =>
			sheet.show({
				event,
				seed: { allDay: event.allDay, calendarId: event.calendarId, day: "" },
			}),
		openNew: (seed: Omit<EventSeed, "calendarId">) =>
			sheet.show({
				event: null,
				seed: { ...seed, calendarId: defaultCalendar },
			}),
	};
}

export function EventEditor({
	calendars,
	event,
	onOpenChange,
	open,
	seed,
}: {
	calendars: Calendar[];
	event: DisplayEvent | null;
	onOpenChange: (open: boolean) => void;
	open: boolean;
	seed: EventSeed;
}) {
	const formId = useId();
	const size = useControlSize();
	const [draft, setDraft] = useState<EventDraft>(() =>
		draftFromEvent(event, seed)
	);
	const [error, setError] = useState<unknown>(null);
	const [message, setMessage] = useState<string | null>(null);

	const close = () => onOpenChange(false);
	const fail = (reason: unknown) => {
		setError(reason);
		setMessage(eventErrorMessage(reason));
	};
	const create = useCreateEvent({ onError: fail });
	const update = useUpdateEvent({ onError: fail });
	const remove = useDeleteEvent();

	const set = <K extends keyof EventDraft>(key: K, value: EventDraft[K]) =>
		setDraft((current) => ({ ...current, [key]: value }));

	const submit = (formEvent: FormEvent) => {
		formEvent.preventDefault();
		const fields = eventFields(draft, currentTimeZone());
		if (fields.error !== undefined) {
			setError(null);
			setMessage(fields.error);
			return;
		}
		setMessage(null);
		if (event) {
			update.mutate(
				{ ...fields, calendarId: event.calendarId, eventId: event.id },
				{ onSuccess: close }
			);
		} else {
			create.mutate(
				{ ...fields, calendarId: draft.calendarId },
				{
					onSuccess: () => {
						toast.success("予定を追加しました");
						close();
					},
				}
			);
		}
	};

	const ids = {
		allDay: `${formId}-all-day`,
		calendar: `${formId}-calendar`,
		description: `${formId}-description`,
		endDay: `${formId}-end-day`,
		endTime: `${formId}-end-time`,
		location: `${formId}-location`,
		startDay: `${formId}-start-day`,
		startTime: `${formId}-start-time`,
		title: `${formId}-title`,
	};
	const calendarName = calendars.find(
		(calendar) => calendar.id === draft.calendarId
	)?.name;

	return (
		<FormSheet
			extraActions={
				event && (
					<div className="flex flex-wrap items-center gap-2">
						<ConfirmDeleteButton
							disabled={remove.isPending}
							onConfirm={() => {
								remove.mutate({
									calendarId: event.calendarId,
									eventId: event.id,
								});
								toast.success("予定を削除しました");
								close();
							}}
						/>
						{event.htmlLink ? (
							<a
								className={cn(
									buttonVariants({ size, variant: "ghost" }),
									"no-underline"
								)}
								href={event.htmlLink}
								rel="noopener"
								target="_blank"
							>
								<IconExternalLink aria-hidden />
								Google で開く
							</a>
						) : null}
					</div>
				)
			}
			formId={formId}
			isSaving={create.isPending || update.isPending}
			onOpenChange={onOpenChange}
			open={open}
			title={event ? "予定を編集" : "予定を追加"}
		>
			<form className="flex flex-col gap-4" id={formId} onSubmit={submit}>
				<Field htmlFor={ids.title} label="タイトル">
					<Input
						autoComplete="off"
						autoFocus={!event}
						id={ids.title}
						onChange={(change) => set("title", change.target.value)}
						placeholder="予定の名前"
						size={size}
						value={draft.title}
					/>
				</Field>
				{event && calendarName ? (
					<p className="m-0 text-muted-foreground text-xs">
						カレンダー: {calendarName}
					</p>
				) : null}
				{event ? null : (
					<Field htmlFor={ids.calendar} label="カレンダー">
						<NativeSelect
							id={ids.calendar}
							onChange={(change) => set("calendarId", change.target.value)}
							size={size}
							value={draft.calendarId}
						>
							{calendars.length === 0 ? (
								<option value={draft.calendarId}>メインのカレンダー</option>
							) : (
								calendars.map((calendar) => (
									<option key={calendar.id} value={calendar.id}>
										{calendar.name}
									</option>
								))
							)}
						</NativeSelect>
					</Field>
				)}
				<div className="flex items-center justify-between gap-3">
					<label className="text-sm" htmlFor={ids.allDay}>
						終日
					</label>
					<Switch
						checked={draft.allDay}
						id={ids.allDay}
						onCheckedChange={(value) => set("allDay", value)}
					/>
				</div>
				<div className="grid grid-cols-2 gap-3">
					<Field htmlFor={ids.startDay} label="開始日">
						<Input
							className="px-2"
							id={ids.startDay}
							onChange={(change) =>
								setDraft((current) =>
									moveStart(current, { startDay: change.target.value })
								)
							}
							size={size}
							type="date"
							value={draft.startDay}
						/>
					</Field>
					{draft.allDay ? (
						<Field htmlFor={ids.endDay} label="終了日">
							<Input
								className="px-2"
								id={ids.endDay}
								onChange={(change) => set("endDay", change.target.value)}
								size={size}
								type="date"
								value={draft.endDay}
							/>
						</Field>
					) : (
						<Field htmlFor={ids.startTime} label="開始">
							<Input
								className="px-2"
								id={ids.startTime}
								onChange={(change) =>
									setDraft((current) =>
										moveStart(current, { startTime: change.target.value })
									)
								}
								size={size}
								type="time"
								value={draft.startTime}
							/>
						</Field>
					)}
					{draft.allDay ? null : (
						<>
							<Field htmlFor={ids.endDay} label="終了日">
								<Input
									className="px-2"
									id={ids.endDay}
									onChange={(change) => set("endDay", change.target.value)}
									size={size}
									type="date"
									value={draft.endDay}
								/>
							</Field>
							<Field htmlFor={ids.endTime} label="終了">
								<Input
									className="px-2"
									id={ids.endTime}
									onChange={(change) => set("endTime", change.target.value)}
									size={size}
									type="time"
									value={draft.endTime}
								/>
							</Field>
						</>
					)}
				</div>
				<Field htmlFor={ids.location} label="場所">
					<Input
						autoComplete="off"
						id={ids.location}
						onChange={(change) => set("location", change.target.value)}
						size={size}
						value={draft.location}
					/>
				</Field>
				<Field htmlFor={ids.description} label="メモ">
					<Textarea
						className="min-h-16"
						id={ids.description}
						onChange={(change) => set("description", change.target.value)}
						size={size}
						value={draft.description}
					/>
				</Field>
				{event?.recurring ? (
					<p className="m-0 flex items-center gap-1.5 text-muted-foreground text-xs">
						<IconRepeat aria-hidden className="size-3.5 shrink-0" />
						繰り返しの予定です。変更と削除はこの回だけに反映されます。
					</p>
				) : null}
				{message && (
					<div className="flex flex-wrap items-center gap-2">
						<FieldError>{message}</FieldError>
						{isCalendarNotConnected(error) ? (
							<Button
								onClick={() => connectGoogle()}
								size="sm"
								type="button"
								variant="outline"
							>
								連携し直す
							</Button>
						) : null}
					</div>
				)}
			</form>
		</FormSheet>
	);
}
