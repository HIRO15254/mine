import { IconChevronRight, IconPlus, IconTag } from "@tabler/icons-react";
import { useMutation } from "@tanstack/react-query";
import { TRPCClientError } from "@trpc/client";
import { type FormEvent, useId, useState } from "react";

import { FormSheet } from "@/components/form-sheet/form-sheet";
import { Button } from "@/components/ui/button/button";
import { Field } from "@/components/ui/field/field";
import { Input } from "@/components/ui/input/input";
import { useIsDesk } from "@/hooks/use-media-query";
import type { Label } from "@/lib/tasks";
import { trpc } from "@/utils/trpc";

import { ConfirmDeleteButton } from "./confirm-delete-button";
import { useInvalidateTasks, useTaskContext } from "./use-tasks";

function isConflict(error: unknown): boolean {
	return error instanceof TRPCClientError && error.data?.code === "CONFLICT";
}

export function LabelSettings() {
	const { isPending, labels } = useTaskContext();
	const [editor, setEditor] = useState<{
		key: number;
		label: Label | null;
		open: boolean;
	}>({ key: 0, label: null, open: false });
	const open = (label: Label | null) =>
		setEditor((current) => ({ key: current.key + 1, label, open: true }));

	return (
		<div className="flex flex-col gap-2">
			{!isPending && labels.length === 0 && (
				<p className="m-0 text-muted-foreground text-sm">
					ラベルはまだありません
				</p>
			)}
			{labels.length > 0 && (
				<ul className="m-0 flex list-none flex-col divide-y divide-border rounded-lg border border-border bg-card p-0">
					{labels.map((label) => (
						<li key={label.id}>
							<button
								className="flex min-h-[var(--m-list-row)] w-full cursor-pointer items-center gap-2.5 border-0 bg-transparent px-3 py-2 text-left text-foreground text-sm outline-none hover:bg-accent focus-visible:shadow-[inset_0_0_0_2px_var(--ring)]"
								onClick={() => open(label)}
								type="button"
							>
								<IconTag
									aria-hidden
									className="size-4 shrink-0 text-muted-foreground"
								/>
								<span className="min-w-0 flex-1 truncate">{label.name}</span>
								<IconChevronRight
									aria-hidden
									className="size-4 text-muted-foreground"
								/>
							</button>
						</li>
					))}
				</ul>
			)}
			<p className="m-0 text-muted-foreground text-xs">
				「next」ラベルを付けたタスクは、日付がなくても今日に出ます。
			</p>
			<Button
				className="self-start"
				onClick={() => open(null)}
				type="button"
				variant="secondary"
			>
				<IconPlus aria-hidden />
				ラベルを追加
			</Button>
			<LabelEditor
				key={editor.key}
				label={editor.label}
				onOpenChange={(value) =>
					setEditor((current) => ({ ...current, open: value }))
				}
				open={editor.open}
			/>
		</div>
	);
}

function LabelEditor({
	label,
	onOpenChange,
	open,
}: {
	label: Label | null;
	onOpenChange: (open: boolean) => void;
	open: boolean;
}) {
	const formId = useId();
	const size = useIsDesk() ? "default" : "xl";
	const invalidate = useInvalidateTasks();
	const [name, setName] = useState(label?.name ?? "");
	const [error, setError] = useState<string | null>(null);

	const close = () => onOpenChange(false);
	const onError = (cause: unknown) =>
		setError(
			isConflict(cause) ? "同じ名前のラベルがあります" : "保存できませんでした"
		);
	const create = useMutation(
		trpc.label.create.mutationOptions({
			onError,
			onSettled: invalidate,
			onSuccess: close,
		})
	);
	const update = useMutation(
		trpc.label.update.mutationOptions({
			onError,
			onSettled: invalidate,
			onSuccess: close,
		})
	);
	const remove = useMutation(
		trpc.label.delete.mutationOptions({
			onError: () => setError("削除できませんでした"),
			onSettled: invalidate,
			onSuccess: close,
		})
	);

	const submit = (event: FormEvent) => {
		event.preventDefault();
		const trimmed = name.trim();
		if (!trimmed) {
			setError("名前を入力してください");
			return;
		}
		if (label) {
			update.mutate({ id: label.id, name: trimmed });
		} else {
			create.mutate({ name: trimmed });
		}
	};

	return (
		<FormSheet
			extraActions={
				label && (
					<ConfirmDeleteButton
						disabled={remove.isPending}
						onConfirm={() => remove.mutate({ id: label.id })}
					/>
				)
			}
			formId={formId}
			isSaving={create.isPending || update.isPending}
			onOpenChange={onOpenChange}
			open={open}
			title={label ? "ラベルを編集" : "ラベルを追加"}
		>
			<form className="flex flex-col gap-4" id={formId} onSubmit={submit}>
				<Field error={error} htmlFor={`${formId}-name`} label="名前" required>
					<Input
						autoComplete="off"
						id={`${formId}-name`}
						onChange={(event) => setName(event.target.value)}
						size={size}
						value={name}
					/>
				</Field>
			</form>
		</FormSheet>
	);
}
