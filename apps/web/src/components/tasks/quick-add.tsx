import { IconAdjustmentsHorizontal, IconPlus } from "@tabler/icons-react";
import { type FormEvent, useId, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button/button";
import { IconButton } from "@/components/ui/icon-button/icon-button";
import { Input } from "@/components/ui/input/input";
import { useIsDesk } from "@/hooks/use-media-query";
import { type Label, type Project, parseQuickAdd, todayKey } from "@/lib/tasks";
import type { DraftDefaults } from "./task-draft";
import { useCreateTask } from "./use-tasks";

/**
 * One-line entry that understands "p1", "#プロジェクト", "@ラベル" and
 * "今日/明日/明後日". Tokens it does not recognise stay in the title.
 */
export function QuickAdd({
	autoFocus,
	defaults,
	initialText,
	labels,
	onAdded,
	onOpenEditor,
	projects,
}: {
	autoFocus?: boolean;
	defaults?: DraftDefaults;
	initialText?: string;
	labels: Label[];
	onAdded?: () => void;
	onOpenEditor: () => void;
	projects: Project[];
}) {
	const id = useId();
	const isDesk = useIsDesk();
	const [text, setText] = useState(initialText ?? "");
	// The task shows in the lists at once; the box is free for the next one.
	const create = useCreateTask(() => toast.error("追加できませんでした"));

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
		const submitted = text;
		create.mutate(
			{
				labelIds: parsed.labelIds,
				priority: parsed.priority,
				projectId: parsed.projectId ?? defaults?.projectId ?? null,
				scheduledDate: parsed.scheduledDate ?? defaults?.scheduledDate ?? null,
				title: parsed.title,
			},
			// Give the text back if it could not be saved.
			{ onError: () => setText((current) => current || submitted) }
		);
		setText("");
		onAdded?.();
	};

	return (
		<form className="flex items-center gap-1.5" onSubmit={submit}>
			<label className="sr-only" htmlFor={id}>
				タスクを追加
			</label>
			<Input
				autoComplete="off"
				// Opened from a shortcut or a share: the box is why the page is open.
				autoFocus={autoFocus}
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
				disabled={!text.trim()}
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
