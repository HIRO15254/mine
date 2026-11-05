import { IconAdjustmentsHorizontal, IconPlus } from "@tabler/icons-react";
import { useMutation } from "@tanstack/react-query";
import { type FormEvent, useId, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button/button";
import { IconButton } from "@/components/ui/icon-button/icon-button";
import { Input } from "@/components/ui/input/input";
import { useIsDesk } from "@/hooks/use-media-query";
import { type Label, type Project, parseQuickAdd, todayKey } from "@/lib/tasks";
import { trpc } from "@/utils/trpc";

import type { DraftDefaults } from "./task-draft";
import { useInvalidateTasks } from "./use-tasks";

/**
 * One-line entry that understands "p1", "#プロジェクト", "@ラベル" and
 * "今日/明日/明後日". Tokens it does not recognise stay in the title.
 */
export function QuickAdd({
	defaults,
	labels,
	onOpenEditor,
	projects,
}: {
	defaults?: DraftDefaults;
	labels: Label[];
	onOpenEditor: () => void;
	projects: Project[];
}) {
	const id = useId();
	const isDesk = useIsDesk();
	const [text, setText] = useState("");
	const invalidate = useInvalidateTasks();
	const create = useMutation(
		trpc.task.create.mutationOptions({
			onSettled: invalidate,
			onSuccess: () => setText(""),
			onError: () => toast.error("追加できませんでした"),
		})
	);

	const submit = (event: FormEvent) => {
		event.preventDefault();
		const parsed = parseQuickAdd(text, {
			labels,
			projects,
			today: todayKey(),
		});
		if (!parsed.title) {
			return;
		}
		create.mutate({
			labelIds: parsed.labelIds,
			priority: parsed.priority,
			projectId: parsed.projectId ?? defaults?.projectId ?? null,
			scheduledDate: parsed.scheduledDate ?? defaults?.scheduledDate ?? null,
			title: parsed.title,
		});
	};

	return (
		<form className="flex items-center gap-1.5" onSubmit={submit}>
			<label className="sr-only" htmlFor={id}>
				タスクを追加
			</label>
			<Input
				autoComplete="off"
				disabled={create.isPending}
				enterKeyHint="done"
				id={id}
				onChange={(event) => setText(event.target.value)}
				placeholder={
					isDesk
						? "タスクを追加（p1 #プロジェクト @ラベル 明日）"
						: "タスクを追加"
				}
				size={isDesk ? "default" : "xl"}
				value={text}
			/>
			<Button
				aria-label="追加"
				className={isDesk ? undefined : "w-[var(--m-control)] px-0"}
				disabled={create.isPending || !text.trim()}
				size={isDesk ? "icon" : "xl"}
				title="追加"
				type="submit"
			>
				<IconPlus aria-hidden />
			</Button>
			<IconButton
				label="詳しく入力"
				onClick={onOpenEditor}
				size={isDesk ? "md" : "xl"}
				type="button"
			>
				<IconAdjustmentsHorizontal aria-hidden />
			</IconButton>
		</form>
	);
}
