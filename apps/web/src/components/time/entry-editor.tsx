import { useMutation } from "@tanstack/react-query";
import { type FormEvent, useId, useState } from "react";
import { toast } from "sonner";

import { FormSheet } from "@/components/form-sheet/form-sheet";
import { useSheetState } from "@/components/form-sheet/use-sheet-state";
import { ConfirmDeleteButton } from "@/components/tasks/confirm-delete-button";
import { openOr, ProjectOptions } from "@/components/tasks/project-options";
import { Field, FieldError } from "@/components/ui/field/field";
import { Input } from "@/components/ui/input/input";
import { NativeSelect } from "@/components/ui/native-select/native-select";
import { Switch } from "@/components/ui/switch/switch";
import { useControlSize } from "@/hooks/use-media-query";
import type { Project } from "@/lib/tasks";
import type { TimeEntry } from "@/lib/time";
import { trpc } from "@/lib/trpc";

import {
	draftFromEntry,
	draftTimes,
	type EntryDraft,
	editedTimes,
} from "./entry-draft";
import { useInvalidateTime } from "./use-time";

/** Owns the entry editor's open state; render `editor` once per page. */
export function useEntryEditor(projects: Project[]) {
	const sheet = useSheetState<TimeEntry | null>(null);
	const editor = (
		<EntryEditor
			entry={sheet.value}
			key={sheet.key}
			onOpenChange={sheet.setOpen}
			open={sheet.open}
			projects={projects}
		/>
	);
	return {
		editor,
		openEdit: (entry: TimeEntry) => sheet.show(entry),
		openNew: () => sheet.show(null),
	};
}

export function EntryEditor({
	entry,
	onOpenChange,
	open,
	projects,
}: {
	entry: TimeEntry | null;
	onOpenChange: (open: boolean) => void;
	open: boolean;
	projects: Project[];
}) {
	const formId = useId();
	const size = useControlSize();
	const invalidate = useInvalidateTime();
	const [draft, setDraft] = useState<EntryDraft>(() =>
		draftFromEntry(entry, Date.now())
	);
	const [error, setError] = useState<string | null>(null);

	const close = () => onOpenChange(false);
	const options = {
		onError: () => setError("保存できませんでした"),
		onSettled: invalidate,
		onSuccess: close,
	};
	const create = useMutation(trpc.time.create.mutationOptions(options));
	const update = useMutation(trpc.time.update.mutationOptions(options));
	const remove = useMutation(
		trpc.time.delete.mutationOptions({
			onError: () => setError("削除できませんでした"),
			onSettled: invalidate,
			onSuccess: () => {
				toast.success("記録を削除しました");
				close();
			},
		})
	);

	const set = <K extends keyof EntryDraft>(key: K, value: EntryDraft[K]) =>
		setDraft((current) => ({ ...current, [key]: value }));

	const submit = (event: FormEvent) => {
		event.preventDefault();
		const times = draftTimes(draft, Date.now());
		if (times.error !== undefined) {
			setError(times.error);
			return;
		}
		const fields = {
			billable: draft.billable,
			description: draft.description.trim(),
			projectId: draft.projectId || null,
		};
		if (entry) {
			update.mutate({
				...fields,
				...editedTimes(entry, draft, times),
				id: entry.id,
			});
		} else if (times.endedAt !== null) {
			create.mutate({
				...fields,
				endedAt: times.endedAt,
				startedAt: times.startedAt,
			});
		}
	};

	const ids = {
		billable: `${formId}-billable`,
		day: `${formId}-day`,
		description: `${formId}-description`,
		end: `${formId}-end`,
		project: `${formId}-project`,
		start: `${formId}-start`,
	};

	return (
		<FormSheet
			extraActions={
				entry && (
					<ConfirmDeleteButton
						disabled={remove.isPending}
						onConfirm={() => remove.mutate({ id: entry.id })}
					/>
				)
			}
			formId={formId}
			isSaving={create.isPending || update.isPending}
			onOpenChange={onOpenChange}
			open={open}
			title={entry ? "記録を編集" : "記録を追加"}
		>
			<form className="flex flex-col gap-4" id={formId} onSubmit={submit}>
				<Field htmlFor={ids.description} label="説明">
					<Input
						autoComplete="off"
						id={ids.description}
						onChange={(event) => set("description", event.target.value)}
						placeholder="何をしたか"
						size={size}
						value={draft.description}
					/>
				</Field>
				<Field htmlFor={ids.project} label="プロジェクト">
					<NativeSelect
						id={ids.project}
						onChange={(event) => set("projectId", event.target.value)}
						size={size}
						value={draft.projectId}
					>
						<option value="">プロジェクトなし</option>
						<ProjectOptions
							include={openOr(draft.projectId)}
							projects={projects}
						/>
					</NativeSelect>
				</Field>
				<div className="grid desk:grid-cols-3 grid-cols-1 gap-3">
					<Field htmlFor={ids.day} label="日付">
						<Input
							className="px-2"
							id={ids.day}
							onChange={(event) => set("day", event.target.value)}
							size={size}
							type="date"
							value={draft.day}
						/>
					</Field>
					<div className="desk:col-span-2 grid grid-cols-2 gap-3">
						<Field htmlFor={ids.start} label="開始">
							<Input
								className="px-2"
								id={ids.start}
								onChange={(event) => set("start", event.target.value)}
								size={size}
								type="time"
								value={draft.start}
							/>
						</Field>
						{draft.running ? (
							<Field label="終了">
								<p className="m-0 flex h-[var(--control-md)] items-center text-muted-foreground text-sm">
									計測中
								</p>
							</Field>
						) : (
							<Field htmlFor={ids.end} label="終了">
								<Input
									className="px-2"
									id={ids.end}
									onChange={(event) => set("end", event.target.value)}
									size={size}
									type="time"
									value={draft.end}
								/>
							</Field>
						)}
					</div>
				</div>
				<div className="flex items-center justify-between gap-3">
					<label className="text-sm" htmlFor={ids.billable}>
						請求の対象にする
					</label>
					<Switch
						checked={draft.billable}
						id={ids.billable}
						onCheckedChange={(value) => set("billable", value)}
					/>
				</div>
				{error && <FieldError>{error}</FieldError>}
			</form>
		</FormSheet>
	);
}
