import {
	IconCalendarEvent,
	IconChecklist,
	IconHash,
	IconHistory,
	IconPlayerPlayFilled,
} from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import {
	type ChangeEvent,
	type CSSProperties,
	type FormEvent,
	type KeyboardEvent,
	type ReactNode,
	useId,
	useMemo,
	useRef,
	useState,
} from "react";

import { ProjectName } from "@/components/tasks/project-name";
import { Button } from "@/components/ui/button/button";
import { Input } from "@/components/ui/input/input";
import { useIsDesk } from "@/hooks/use-media-query";
import { rangeOfDays, startOfDay } from "@/lib/calendar-time";
import { type Project, todayKey } from "@/lib/tasks";
import {
	completeHash,
	findHashTokens,
	hashAtCaret,
	parseTimerText,
	type SuggestionKind,
	suggestTimer,
	type TimerSuggestion,
	timerText,
} from "@/lib/timer-input";
import { cn } from "@/lib/utils";
import { trpc } from "@/utils/trpc";

import { useStartTimer } from "./use-time";

const DAY = 86_400_000;
const HISTORY_DAYS = 30;

const KIND_ICON: Record<SuggestionKind, typeof IconHash> = {
	entry: IconHistory,
	event: IconCalendarEvent,
	project: IconHash,
	task: IconChecklist,
};

const KIND_LABEL: Record<SuggestionKind, string> = {
	entry: "前の計測",
	event: "予定",
	project: "プロジェクト",
	task: "タスク",
};

/** Tasks, recent entries and today's events for the suggestions. */
function useSuggestionSources(active: boolean) {
	const today = useMemo(() => startOfDay(new Date()), []);
	const history = useMemo(() => {
		const to = Date.now();
		return { from: to - HISTORY_DAYS * DAY, to };
	}, []);
	const tasks = useQuery({
		...trpc.task.list.queryOptions({ today: todayKey(), view: "open" }),
		enabled: active,
		staleTime: 60_000,
	});
	const entries = useQuery({
		...trpc.time.list.queryOptions(history),
		enabled: active,
		staleTime: 60_000,
	});
	const events = useQuery({
		...trpc.calendar.events.queryOptions(rangeOfDays(today, 1)),
		enabled: active,
		retry: false,
		staleTime: 60_000,
	});
	return {
		entries: entries.data ?? [],
		events: events.data?.events ?? [],
		tasks: tasks.data ?? [],
	};
}

/** The typed text with each "#プロジェクト" drawn in its project's hue. */
function Highlighted({
	projects,
	text,
}: {
	projects: Project[];
	text: string;
}) {
	const parts: ReactNode[] = [];
	let from = 0;
	for (const token of findHashTokens(text, projects)) {
		parts.push(text.slice(from, token.start));
		const word = text.slice(token.start, token.end);
		parts.push(
			token.project ? (
				<mark
					className="rounded-[3px] bg-[color-mix(in_srgb,var(--c)_22%,transparent)] text-[color-mix(in_srgb,var(--c)_75%,var(--foreground))] shadow-[0_0_0_2px_color-mix(in_srgb,var(--c)_22%,transparent)]"
					data-project={token.project.id}
					key={token.start}
					style={{ "--c": `var(--${token.project.color})` } as CSSProperties}
				>
					{word}
				</mark>
			) : (
				<span className="text-muted-foreground" key={token.start}>
					{word}
				</span>
			)
		);
		from = token.end;
	}
	parts.push(text.slice(from));
	return <>{parts}</>;
}

/** The next highlighted suggestion; the list grows upward when placed on top. */
function moveActive(
	key: "ArrowDown" | "ArrowUp",
	current: number,
	count: number,
	placement: "bottom" | "top"
): number {
	const towardList = placement === "top" ? "ArrowUp" : "ArrowDown";
	const delta = key === towardList ? 1 : -1;
	if (current < 0) {
		return delta > 0 ? 0 : count - 1;
	}
	return (current + delta + count) % count;
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
	item: TimerSuggestion;
	onPick: (item: TimerSuggestion) => void;
	projects: Project[];
}) {
	const Icon = KIND_ICON[item.kind];
	const project = projects.find((p) => p.id === item.projectId);
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
			<Icon
				aria-label={KIND_LABEL[item.kind]}
				className="size-4 shrink-0 text-muted-foreground"
			/>
			{item.kind === "project" && project ? (
				<ProjectName
					className="min-w-0 flex-1"
					project={project}
					projects={projects}
				/>
			) : (
				<span className="min-w-0 flex-1 truncate">{item.description}</span>
			)}
			{item.note ? (
				<span className="shrink-0 font-mono text-muted-foreground text-xs tabular-nums">
					{item.note}
				</span>
			) : null}
			{item.kind !== "project" && project ? (
				<ProjectName
					className="max-w-[40%] shrink-0 text-muted-foreground text-xs"
					project={project}
					projects={projects}
				/>
			) : null}
		</button>
	);
}

/**
 * One line that starts the timer: "論文を読む #研究" starts 論文を読む on the
 * project 研究. Typing offers matching tasks, past entries and events; an
 * empty box offers the events around now and recent entries.
 */
export function TimerInput({
	menuPlacement = "bottom",
	projects,
}: {
	/** Where the suggestions open; "top" for a box at the bottom of the screen. */
	menuPlacement?: "bottom" | "top";
	projects: Project[];
}) {
	const id = useId();
	const isDesk = useIsDesk();
	const size = isDesk ? "default" : "xl";
	const input = useRef<HTMLInputElement>(null);
	const mirror = useRef<HTMLDivElement>(null);
	const [text, setText] = useState("");
	const [caret, setCaret] = useState(0);
	const [open, setOpen] = useState(false);
	const [active, setActive] = useState(-1);
	const [picked, setPicked] = useState<{ title: string; id: string } | null>(
		null
	);
	const [touched, setTouched] = useState(false);
	const start = useStartTimer();
	const sources = useSuggestionSources(touched);

	const suggestions = useMemo(
		() =>
			suggestTimer({
				caret,
				entries: sources.entries,
				events: sources.events,
				now: Date.now(),
				projects,
				tasks: sources.tasks,
				text,
			}),
		[caret, projects, sources, text]
	);
	const hash = hashAtCaret(text, caret);
	const showMenu = open && suggestions.length > 0;
	// While a #word is typed, Enter completes the first project.
	const firstOrActive = hash && active < 0 ? 0 : active;
	const current = showMenu ? firstOrActive : -1;

	const syncScroll = () => {
		if (mirror.current && input.current) {
			mirror.current.scrollLeft = input.current.scrollLeft;
		}
	};

	const update = (value: string, position: number) => {
		setText(value);
		setCaret(position);
		setActive(-1);
		setOpen(true);
		requestAnimationFrame(syncScroll);
	};

	const placeCaret = (position: number) => {
		requestAnimationFrame(() => {
			input.current?.setSelectionRange(position, position);
			setCaret(position);
			syncScroll();
		});
	};

	const pick = (item: TimerSuggestion) => {
		if (item.kind === "project" && hash) {
			const project = projects.find((p) => p.id === item.projectId);
			if (project) {
				const next = completeHash(text, hash, project);
				update(next.text, next.caret);
				placeCaret(next.caret);
			}
			return;
		}
		const next = timerText(item.description, item.projectId, projects);
		setPicked(
			item.taskId ? { id: item.taskId, title: item.description } : null
		);
		update(next, next.length);
		setOpen(false);
		placeCaret(next.length);
	};

	const submit = (event: FormEvent) => {
		event.preventDefault();
		const parsed = parseTimerText(text, projects);
		const taskId =
			picked && picked.title === parsed.description ? picked.id : undefined;
		start.mutate(
			{
				description: parsed.description,
				projectId: parsed.projectId,
				taskId,
			},
			{
				onSuccess: () => {
					setText("");
					setCaret(0);
					setPicked(null);
				},
			}
		);
		setOpen(false);
	};

	const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
		if (event.key === "ArrowDown" || event.key === "ArrowUp") {
			event.preventDefault();
			if (showMenu) {
				setActive(
					moveActive(event.key, current, suggestions.length, menuPlacement)
				);
			} else {
				setOpen(true);
			}
			return;
		}
		const completes = event.key === "Enter" || (event.key === "Tab" && hash);
		const item = completes ? suggestions[current] : undefined;
		if (item) {
			event.preventDefault();
			pick(item);
		} else if (event.key === "Escape" && showMenu) {
			event.preventDefault();
			setOpen(false);
		}
	};

	const listId = `${id}-list`;
	const optionId = (index: number) => `${id}-option-${index}`;

	return (
		<form className="relative flex items-center gap-1.5" onSubmit={submit}>
			<label className="sr-only" htmlFor={id}>
				何をしていますか
			</label>
			<div className="relative min-w-0 flex-1">
				<Input
					aria-activedescendant={current >= 0 ? optionId(current) : undefined}
					aria-autocomplete="list"
					aria-controls={listId}
					aria-expanded={showMenu}
					autoComplete="off"
					className="text-transparent caret-foreground selection:bg-primary-soft selection:text-transparent"
					enterKeyHint="go"
					id={id}
					onBlur={() => setOpen(false)}
					onChange={(event: ChangeEvent<HTMLInputElement>) => {
						update(
							event.target.value,
							event.target.selectionStart ?? event.target.value.length
						);
					}}
					onFocus={() => {
						setTouched(true);
						setOpen(true);
					}}
					onKeyDown={onKeyDown}
					onKeyUp={(event) => {
						setCaret(event.currentTarget.selectionStart ?? 0);
						syncScroll();
					}}
					onMouseUp={(event) =>
						setCaret(event.currentTarget.selectionStart ?? 0)
					}
					onScroll={syncScroll}
					placeholder={
						isDesk ? "何をしていますか（#プロジェクト）" : "何をしていますか"
					}
					ref={input}
					role="combobox"
					size={size}
					value={text}
				/>
				<div
					aria-hidden
					className={cn(
						"pointer-events-none absolute inset-px flex items-center overflow-hidden whitespace-pre px-2.5 text-foreground",
						isDesk ? "text-sm" : "text-[length:var(--m-text-body)]"
					)}
					data-slot="timer-input-mirror"
					ref={mirror}
				>
					<span className="shrink-0">
						<Highlighted projects={projects} text={text} />
					</span>
				</div>
			</div>
			<Button
				aria-label="計測を始める"
				className={isDesk ? undefined : "w-[var(--m-control)] px-0"}
				disabled={start.isPending}
				size={isDesk ? "icon" : "xl"}
				title="計測を始める"
				type="submit"
			>
				<IconPlayerPlayFilled aria-hidden />
			</Button>
			<div
				aria-label="候補"
				className={cn(
					"absolute inset-x-0 z-30 flex max-h-72 flex-col gap-px overflow-auto rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-[var(--shadow-popover)]",
					menuPlacement === "top"
						? "bottom-full mb-2 flex-col-reverse"
						: "top-full mt-1.5",
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
