import {
	IconAdjustmentsHorizontal,
	IconHash,
	IconPlus,
	IconTag,
} from "@tabler/icons-react";
import {
	type ChangeEvent,
	type FormEvent,
	type KeyboardEvent,
	type SyntheticEvent,
	useId,
	useLayoutEffect,
	useRef,
	useState,
} from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button/button";
import { IconButton } from "@/components/ui/icon-button/icon-button";
import { useControlSize, useIsDesk } from "@/hooks/use-media-query";
import { moveActive, replaceToken, tokenAtCaret } from "@/lib/caret-token";
import {
	QUICK_ADD_TRIGGERS,
	type QuickAddSuggestion,
	suggestQuickAdd,
} from "@/lib/quick-add";
import {
	type Label,
	type Project,
	type QuickAddToken,
	readQuickAdd,
	todayKey,
} from "@/lib/tasks";
import { cn } from "@/lib/utils";
import { MarkedInput, type TextMark } from "./marked-input";
import { ProjectName } from "./project-name";
import type { DraftDefaults } from "./task-draft";
import { useCreateTask } from "./use-tasks";

const lower = (value: string) => value.toLocaleLowerCase("ja");

const PRIORITY_COLOR: Record<number, string> = {
	1: "var(--destructive)",
	2: "var(--warning)",
	3: "var(--primary)",
	4: "var(--muted-foreground)",
};

/**
 * Each token that will not be part of the title, as a chip: a project in
 * its hue, a priority in its color, a day in the color of "today".
 */
function tokenMark(token: QuickAddToken, projects: Project[]): TextMark {
	const project = projects.find((item) => item.id === token.projectId);
	const color = {
		date: "var(--success)",
		label: "var(--primary)",
		priority: PRIORITY_COLOR[token.priority ?? 4] ?? null,
		project: project ? `var(--${project.color})` : null,
	}[token.kind];
	return { ...token, color };
}

function SuggestionOption({
	active,
	id,
	item,
	onPick,
	projects,
}: {
	active: boolean;
	id: string;
	item: QuickAddSuggestion;
	onPick: (item: QuickAddSuggestion) => void;
	projects: Project[];
}) {
	return (
		<button
			aria-selected={active}
			className={cn(
				"flex min-h-[var(--control-md)] w-full shrink-0 cursor-pointer items-center gap-2 rounded-md border-0 bg-transparent px-2 py-1.5 text-left desk:text-sm text-[length:var(--m-text-body)] text-foreground",
				active ? "bg-primary-soft text-primary-text" : "hover:layer-accent"
			)}
			id={id}
			onClick={() => onPick(item)}
			// Keep the focus in the box so the caret stays put.
			onMouseDown={(event) => event.preventDefault()}
			role="option"
			tabIndex={-1}
			type="button"
		>
			{item.kind === "project" ? (
				<>
					<IconHash
						aria-label="プロジェクト"
						className="size-4 shrink-0 text-muted-foreground"
					/>
					<ProjectName
						className="min-w-0 flex-1"
						project={item.project}
						projects={projects}
					/>
				</>
			) : (
				<>
					<IconTag
						aria-label="ラベル"
						className="size-4 shrink-0 text-muted-foreground"
					/>
					<span className="min-w-0 flex-1 truncate">{item.label.name}</span>
				</>
			)}
		</button>
	);
}

/**
 * One-line entry that understands "p1", "#プロジェクト", "@ラベル" and
 * "今日/明日/明後日". Tokens it does not recognise stay in the title. Typing
 * "#" offers the projects and "@" the labels; ↑↓ choose, Enter or Tab
 * completes.
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
	const size = useControlSize();
	const input = useRef<HTMLInputElement>(null);
	const [text, setText] = useState(initialText ?? "");
	const [caret, setCaret] = useState(0);
	const [open, setOpen] = useState(false);
	const [active, setActive] = useState(-1);
	// The project chosen from the suggestions, kept by id: the text alone
	// cannot tell two projects of the same name apart.
	const [pickedProjectId, setPickedProjectId] = useState<string | null>(null);
	// The task shows in the lists at once; the box is free for the next one.
	const create = useCreateTask(() => toast.error("追加できませんでした"));
	// Where the caret goes once a completion is on screen. Placed as the text
	// renders, so a key pressed right after the pick lands after it.
	const pendingCaret = useRef<number | null>(null);
	useLayoutEffect(() => {
		if (pendingCaret.current !== null) {
			input.current?.setSelectionRange(
				pendingCaret.current,
				pendingCaret.current
			);
			pendingCaret.current = null;
		}
	});

	const read = readQuickAdd(text, {
		labels,
		preferredProjectId: pickedProjectId,
		projects,
		today: todayKey(),
	});
	const token = tokenAtCaret(text, caret, QUICK_ADD_TRIGGERS);
	const suggestions = suggestQuickAdd({ labels, projects, token });
	const showMenu = open && suggestions.length > 0;
	// The first suggestion is ready for Enter until another is chosen.
	const current = showMenu ? Math.max(active, 0) : -1;

	const update = (value: string, position: number) => {
		setText(value);
		setCaret(position);
		setActive(-1);
		setOpen(true);
	};

	const pick = (item: QuickAddSuggestion) => {
		if (!token) {
			return;
		}
		const next = replaceToken(text, token, item.insert);
		if (item.kind === "project") {
			setPickedProjectId(item.project.id);
		}
		pendingCaret.current = next.caret;
		update(next.text, next.caret);
	};

	const submit = (event: FormEvent) => {
		event.preventDefault();
		const parsed = read.result;
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
			{ onError: () => setText((value) => value || submitted) }
		);
		setText("");
		setCaret(0);
		setOpen(false);
		setPickedProjectId(null);
		onAdded?.();
	};

	const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
		// Keys pressed while converting kana belong to the IME, not to the list.
		if (event.nativeEvent.isComposing || event.keyCode === 229 || !showMenu) {
			return;
		}
		if (event.key === "ArrowDown" || event.key === "ArrowUp") {
			event.preventDefault();
			setActive(moveActive(event.key, current, suggestions.length));
			return;
		}
		if (event.key === "Escape") {
			event.preventDefault();
			setOpen(false);
			return;
		}
		const item = suggestions[current];
		if (!(item && token && (event.key === "Enter" || event.key === "Tab"))) {
			return;
		}
		// A word typed out in full adds the task on Enter, as it did before
		// there were suggestions.
		const typed = lower(text.slice(token.start, token.end));
		if (event.key === "Enter" && active < 0 && typed === lower(item.insert)) {
			return;
		}
		event.preventDefault();
		pick(item);
	};

	const readCaret = (event: SyntheticEvent<HTMLInputElement>) =>
		setCaret(event.currentTarget.selectionStart ?? 0);

	const listId = `${id}-list`;
	const optionId = (index: number) => `${id}-option-${index}`;

	return (
		<form className="relative flex items-center gap-1.5" onSubmit={submit}>
			<label className="sr-only" htmlFor={id}>
				タスクを追加
			</label>
			<MarkedInput
				aria-activedescendant={current >= 0 ? optionId(current) : undefined}
				aria-autocomplete="list"
				aria-controls={listId}
				aria-expanded={showMenu}
				autoComplete="off"
				// Opened from a shortcut or a share: the box is why the page is open.
				autoFocus={autoFocus}
				enterKeyHint="done"
				id={id}
				marks={read.tokens.map((item) => tokenMark(item, projects))}
				onBlur={() => setOpen(false)}
				onChange={(event: ChangeEvent<HTMLInputElement>) =>
					update(
						event.target.value,
						event.target.selectionStart ?? event.target.value.length
					)
				}
				onFocus={() => setOpen(true)}
				onKeyDown={onKeyDown}
				onSelect={readCaret}
				placeholder={
					isDesk
						? "タスクを追加（p1 #プロジェクト @ラベル 明日）"
						: "タスクを追加"
				}
				ref={input}
				role="combobox"
				size={size}
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
			<div
				aria-label="候補"
				className={cn(
					"absolute inset-x-0 top-full z-30 mt-1.5 flex max-h-72 flex-col gap-px overflow-auto rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-[var(--shadow-popover)]",
					!showMenu && "hidden"
				)}
				id={listId}
				role="listbox"
			>
				{suggestions.map((item, index) => (
					<SuggestionOption
						active={index === current}
						id={optionId(index)}
						item={item}
						key={item.key}
						onPick={pick}
						projects={projects}
					/>
				))}
			</div>
		</form>
	);
}
