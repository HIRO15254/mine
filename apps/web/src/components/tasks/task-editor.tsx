import { type FormEvent, useEffect, useId, useRef, useState } from "react";
import { toast } from "sonner";

import { FormSheet } from "@/components/form-sheet/form-sheet";
import { Field, FieldError } from "@/components/ui/field/field";
import { Input } from "@/components/ui/input/input";
import { NativeSelect } from "@/components/ui/native-select/native-select";
import { Textarea } from "@/components/ui/textarea/textarea";
import {
	ToggleGroup,
	ToggleGroupItem,
} from "@/components/ui/toggle-group/toggle-group";
import { useIsDesk } from "@/hooks/use-media-query";
import {
	flattenProjects,
	type Label,
	PRIORITY_RING,
	type Project,
	type Task,
} from "@/lib/tasks";
import { cn } from "@/lib/utils";
import { ConfirmDeleteButton } from "./confirm-delete-button";
import {
	type DraftDefaults,
	draftError,
	draftFromTask,
	draftToInput,
	type RepeatBasis,
	type TaskDraft,
} from "./task-draft";
import { useCreateTask, useDeleteTask, useUpdateTask } from "./use-tasks";

interface EditorState {
	defaults?: DraftDefaults;
	/** Bumped on every open so the form starts fresh. */
	key: number;
	open: boolean;
	task: Task | null;
}

/** Owns the editor's open state; render `editor` once per page. */
export function useTaskEditor({
	labels,
	projects,
}: {
	labels: Label[];
	projects: Project[];
}) {
	const [state, setState] = useState<EditorState>({
		key: 0,
		open: false,
		task: null,
	});
	const openNew = (defaults?: DraftDefaults) =>
		setState((current) => ({
			defaults,
			key: current.key + 1,
			open: true,
			task: null,
		}));
	const openEdit = (task: Task) =>
		setState((current) => ({ key: current.key + 1, open: true, task }));
	const editor = (
		<TaskEditor
			defaults={state.defaults}
			key={state.key}
			labels={labels}
			onOpenChange={(open) => setState((current) => ({ ...current, open }))}
			open={state.open}
			projects={projects}
			task={state.task}
		/>
	);
	return { editor, openEdit, openNew };
}

/** Monday first, matching the calendar. */
const WEEKDAY_OPTIONS = [
	{ label: "月", value: 1 },
	{ label: "火", value: 2 },
	{ label: "水", value: 3 },
	{ label: "木", value: 4 },
	{ label: "金", value: 5 },
	{ label: "土", value: 6 },
	{ label: "日", value: 0 },
];

const PRIORITIES = [1, 2, 3, 4];

export function TaskEditor({
	defaults,
	labels,
	onOpenChange,
	open,
	projects,
	task,
}: {
	defaults?: DraftDefaults;
	labels: Label[];
	onOpenChange: (open: boolean) => void;
	open: boolean;
	projects: Project[];
	/** The task to edit, or null to add a new one. */
	task: Task | null;
}) {
	const formId = useId();
	const isDesk = useIsDesk();
	const size = isDesk ? "default" : "xl";
	const [draft, setDraft] = useState<TaskDraft>(() =>
		draftFromTask(task, defaults)
	);
	const [error, setError] = useState<string | null>(null);

	const close = () => onOpenChange(false);
	const mounted = useRef(true);
	useEffect(() => {
		mounted.current = true;
		return () => {
			mounted.current = false;
		};
	}, []);
	// Saving closes the sheet at once and shows the change in the lists; if
	// the server refuses, the lists go back and the sheet reopens with the draft.
	const failed = (message: string) => () => {
		if (!mounted.current) {
			// Another task's sheet (or another screen) is up by now: reopening
			// would show that one, so the failure is told on its own.
			toast.error(message, { description: draft.title.trim() || undefined });
			return;
		}
		setError(message);
		onOpenChange(true);
	};
	const create = useCreateTask(failed("保存できませんでした"));
	const update = useUpdateTask(failed("保存できませんでした"), task);
	const remove = useDeleteTask(failed("削除できませんでした"), () => {
		toast.success("削除しました", { description: task?.title });
	});

	const set = <K extends keyof TaskDraft>(key: K, value: TaskDraft[K]) =>
		setDraft((current) => ({ ...current, [key]: value }));

	const submit = (event: FormEvent) => {
		event.preventDefault();
		const problem = draftError(draft);
		if (problem) {
			setError(problem);
			return;
		}
		const input = draftToInput(draft);
		setError(null);
		if (task) {
			update.mutate({ ...input, id: task.id });
		} else {
			create.mutate(input);
		}
		close();
	};

	const ids = {
		title: `${formId}-title`,
		note: `${formId}-note`,
		project: `${formId}-project`,
		start: `${formId}-start`,
		scheduled: `${formId}-scheduled`,
		time: `${formId}-time`,
		deadline: `${formId}-deadline`,
		repeat: `${formId}-repeat`,
		interval: `${formId}-interval`,
		unit: `${formId}-unit`,
		dayOfMonth: `${formId}-day`,
		estimate: `${formId}-estimate`,
	};

	return (
		<FormSheet
			extraActions={
				task && (
					<ConfirmDeleteButton
						disabled={remove.isPending}
						onConfirm={() => {
							remove.mutate({ id: task.id });
							close();
						}}
					/>
				)
			}
			formId={formId}
			isSaving={create.isPending || update.isPending}
			onOpenChange={onOpenChange}
			open={open}
			title={task ? "タスクを編集" : "タスクを追加"}
		>
			<form className="flex flex-col gap-4" id={formId} onSubmit={submit}>
				<Field htmlFor={ids.title} label="タイトル" required>
					<Input
						autoComplete="off"
						id={ids.title}
						onChange={(event) => set("title", event.target.value)}
						placeholder="やること"
						size={size}
						value={draft.title}
					/>
				</Field>
				<Field htmlFor={ids.note} label="メモ">
					<Textarea
						className="min-h-16"
						id={ids.note}
						onChange={(event) => set("note", event.target.value)}
						size={size}
						value={draft.note}
					/>
				</Field>
				<div className="grid grid-cols-2 gap-3">
					<Field htmlFor={ids.project} label="プロジェクト">
						<NativeSelect
							id={ids.project}
							onChange={(event) => set("projectId", event.target.value)}
							size={size}
							value={draft.projectId}
						>
							<option value="">インボックス</option>
							{flattenProjects(projects)
								.filter((p) => !p.archived || p.id === draft.projectId)
								.map((p) => (
									<option key={p.id} value={p.id}>
										{"　".repeat(p.depth)}
										{p.name}
									</option>
								))}
						</NativeSelect>
					</Field>
					<Field htmlFor={ids.estimate} label="見積もり（分）">
						<Input
							id={ids.estimate}
							inputMode="numeric"
							min={1}
							onChange={(event) => set("estimate", event.target.value)}
							size={size}
							type="number"
							value={draft.estimate}
						/>
					</Field>
				</div>
				<fieldset className="m-0 flex flex-col gap-1.5 border-0 p-0">
					<legend className="mb-1.5 p-0 font-medium text-sm">優先度</legend>
					<ToggleGroup
						aria-label="優先度"
						onValueChange={(value) => {
							if (value) {
								set("priority", Number(value));
							}
						}}
						type="single"
						value={String(draft.priority)}
					>
						{PRIORITIES.map((priority) => (
							<ToggleGroupItem key={priority} value={String(priority)}>
								<span
									aria-hidden
									className={cn(
										"size-2.5 rounded-full border-[1.5px]",
										PRIORITY_RING[priority]
									)}
								/>
								P{priority}
							</ToggleGroupItem>
						))}
					</ToggleGroup>
				</fieldset>
				<div className="grid desk:grid-cols-3 grid-cols-1 gap-3">
					<Field htmlFor={ids.start} label="着手日">
						<Input
							className="px-2"
							id={ids.start}
							onChange={(event) => set("startDate", event.target.value)}
							size={size}
							type="date"
							value={draft.startDate}
						/>
					</Field>
					<Field htmlFor={ids.scheduled} label="予定日">
						<Input
							className="px-2"
							id={ids.scheduled}
							onChange={(event) => set("scheduledDate", event.target.value)}
							size={size}
							type="date"
							value={draft.scheduledDate}
						/>
					</Field>
					<Field htmlFor={ids.deadline} label="締め切り">
						<Input
							className="px-2"
							id={ids.deadline}
							onChange={(event) => set("deadline", event.target.value)}
							size={size}
							type="date"
							value={draft.deadline}
						/>
					</Field>
				</div>
				{draft.scheduledDate ? (
					<div className="grid desk:grid-cols-3 grid-cols-1 gap-3">
						<Field className="desk:col-start-2" htmlFor={ids.time} label="時刻">
							<Input
								className="px-2"
								id={ids.time}
								onChange={(event) => set("scheduledTime", event.target.value)}
								size={size}
								step={900}
								type="time"
								value={draft.scheduledTime}
							/>
						</Field>
					</div>
				) : null}
				<RepeatFields draft={draft} ids={ids} set={set} size={size} />
				{labels.length > 0 && (
					<fieldset className="m-0 flex flex-col border-0 p-0">
						<legend className="mb-1.5 p-0 font-medium text-sm">ラベル</legend>
						<ToggleGroup
							aria-label="ラベル"
							className="flex flex-wrap"
							onValueChange={(value) => set("labelIds", value)}
							type="multiple"
							value={draft.labelIds}
						>
							{labels.map((label) => (
								<ToggleGroupItem key={label.id} value={label.id}>
									{label.name}
								</ToggleGroupItem>
							))}
						</ToggleGroup>
					</fieldset>
				)}
				{error && <FieldError>{error}</FieldError>}
			</form>
		</FormSheet>
	);
}

function RepeatFields({
	draft,
	ids,
	set,
	size,
}: {
	draft: TaskDraft;
	ids: Record<"dayOfMonth" | "interval" | "repeat" | "unit", string>;
	set: <K extends keyof TaskDraft>(key: K, value: TaskDraft[K]) => void;
	size: "default" | "xl";
}) {
	return (
		<div className="flex flex-col gap-3">
			<div className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)] items-end gap-3">
				<Field htmlFor={ids.repeat} label="繰り返し">
					<NativeSelect
						id={ids.repeat}
						onChange={(event) =>
							set("repeat", event.target.value as RepeatBasis)
						}
						size={size}
						value={draft.repeat}
					>
						<option value="none">しない</option>
						<option value="schedule">予定日から</option>
						<option value="completion">完了日から</option>
					</NativeSelect>
				</Field>
				{draft.repeat !== "none" && (
					<>
						<Field htmlFor={ids.interval} label="間隔">
							<Input
								id={ids.interval}
								inputMode="numeric"
								max={365}
								min={1}
								onChange={(event) => set("interval", event.target.value)}
								size={size}
								type="number"
								value={draft.interval}
							/>
						</Field>
						<Field htmlFor={ids.unit} label="単位">
							<NativeSelect
								id={ids.unit}
								onChange={(event) =>
									set("unit", event.target.value as TaskDraft["unit"])
								}
								size={size}
								value={draft.unit}
							>
								<option value="day">日ごと</option>
								<option value="week">週ごと</option>
								<option value="month">か月ごと</option>
							</NativeSelect>
						</Field>
					</>
				)}
			</div>
			{draft.repeat === "schedule" && draft.unit === "week" && (
				<ToggleGroup
					aria-label="曜日"
					onValueChange={(value) => set("weekdays", value.map(Number))}
					type="multiple"
					value={draft.weekdays.map(String)}
				>
					{WEEKDAY_OPTIONS.map((day) => (
						<ToggleGroupItem
							className="px-0"
							key={day.value}
							value={String(day.value)}
						>
							{day.label}
						</ToggleGroupItem>
					))}
				</ToggleGroup>
			)}
			{draft.repeat === "schedule" && draft.unit === "month" && (
				<Field className="max-w-40" htmlFor={ids.dayOfMonth} label="日にち">
					<Input
						id={ids.dayOfMonth}
						inputMode="numeric"
						max={31}
						min={1}
						onChange={(event) => set("dayOfMonth", event.target.value)}
						placeholder="予定日と同じ"
						size={size}
						type="number"
						value={draft.dayOfMonth}
					/>
				</Field>
			)}
		</div>
	);
}
