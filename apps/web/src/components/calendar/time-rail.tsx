import { IconPencil } from "@tabler/icons-react";
import { type CSSProperties, useEffect, useRef, useState } from "react";

import { ProjectName } from "@/components/tasks/project-name";
import { Button } from "@/components/ui/button/button";
import { addDays, formatClock, startOfDay } from "@/lib/calendar-time";
import type { Project } from "@/lib/tasks";
import { formatDuration, type TimeEntry } from "@/lib/time";
import { cn } from "@/lib/utils";

/** The width the rail keeps free at the left of each day column. */
export const RAIL_WIDTH_PX = 6;

interface Segment {
	end: number;
	entry: TimeEntry;
	start: number;
}

/** The parts of the entries that fall on `day`, as instants. */
export function railSegments(
	entries: TimeEntry[],
	day: Date,
	now: number
): Segment[] {
	const from = startOfDay(day).getTime();
	const to = addDays(day, 1).getTime();
	return entries
		.map((entry) => ({
			end: Math.min(entry.endedAt ?? now, to),
			entry,
			start: Math.max(entry.startedAt, from),
		}))
		.filter((segment) => segment.end > segment.start)
		.sort((a, b) => a.start - b.start);
}

function EntryCard({
	entry,
	flip,
	now,
	onEdit,
	open,
	projects,
}: {
	entry: TimeEntry;
	flip: boolean;
	now: number;
	onEdit: (entry: TimeEntry) => void;
	open: boolean;
	projects: Project[];
}) {
	const project = projects.find((item) => item.id === entry.projectId);
	const end = entry.endedAt;
	return (
		<div
			aria-label="時間の記録"
			className={cn(
				"absolute top-0 z-[30] hidden w-56 max-w-[min(14rem,calc(100vw-5rem))] flex-col gap-1 rounded-md bg-popover p-2.5 text-popover-foreground text-xs shadow-[var(--shadow-popover)]",
				"group-hover/segment:flex",
				open && "flex",
				flip ? "right-full" : "left-full"
			)}
			data-slot="time-rail-card"
			role="dialog"
		>
			{project ? (
				<ProjectName
					className="font-medium"
					project={project}
					projects={projects}
				/>
			) : (
				<span className="text-muted-foreground">プロジェクトなし</span>
			)}
			<span className="break-words font-medium text-foreground text-sm">
				{entry.description || "（説明なし）"}
			</span>
			<span className="font-mono text-muted-foreground tabular-nums">
				{formatClock(entry.startedAt)}–{end === null ? "" : formatClock(end)}
				{" · "}
				{end === null
					? `計測中 ${formatDuration(now - entry.startedAt)}`
					: formatDuration(end - entry.startedAt)}
			</span>
			<Button
				className="mt-1 self-start"
				onClick={() => onEdit(entry)}
				size="sm"
				type="button"
				variant="outline"
			>
				<IconPencil aria-hidden />
				記録を編集
			</Button>
		</div>
	);
}

/**
 * The time recorded on a day, as a thin line down the left edge of its
 * column: one stretch per entry in its project's hue. Hovering a stretch,
 * or tapping it, shows what was recorded.
 */
export function TimeRail({
	day,
	entries,
	flip = false,
	hourHeight,
	now,
	onEditEntry,
	projects,
}: {
	day: Date;
	entries: TimeEntry[];
	/** Open the details to the left, for the last columns of the week. */
	flip?: boolean;
	hourHeight: number;
	now: number;
	onEditEntry: (entry: TimeEntry) => void;
	projects: Project[];
}) {
	// Hover shows a card through CSS; a tap (or click) keeps it open.
	const [pinned, setPinned] = useState<string | null>(null);
	const rail = useRef<HTMLDivElement>(null);
	const from = startOfDay(day).getTime();
	const segments = railSegments(entries, day, now);

	// A tap anywhere else closes what a tap opened.
	useEffect(() => {
		if (!pinned) {
			return;
		}
		const close = (event: PointerEvent) => {
			if (!rail.current?.contains(event.target as Node)) {
				setPinned(null);
			}
		};
		document.addEventListener("pointerdown", close);
		return () => document.removeEventListener("pointerdown", close);
	}, [pinned]);

	if (segments.length === 0) {
		return null;
	}
	const minutes = (ms: number) => (ms - from) / 60_000;
	return (
		<div
			className={cn(
				// Above the next day's rail while a card is open.
				"pointer-events-none absolute inset-y-0 left-0 z-[15] focus-within:z-[40] hover:z-[40]",
				pinned && "z-[40]"
			)}
			data-slot="time-rail"
			ref={rail}
			style={{ width: RAIL_WIDTH_PX }}
		>
			{segments.map((segment) => {
				const project = projects.find(
					(item) => item.id === segment.entry.projectId
				);
				const top = (minutes(segment.start) / 60) * hourHeight;
				const height = Math.max(
					((segment.end - segment.start) / 3_600_000) * hourHeight,
					3
				);
				const id = segment.entry.id;
				const label = `${segment.entry.description || "記録"} ${formatClock(segment.entry.startedAt)}–${
					segment.entry.endedAt === null
						? "計測中"
						: formatClock(segment.entry.endedAt)
				}`;
				return (
					<div
						className="group/segment pointer-events-auto absolute left-0"
						key={id}
						style={{ height, top, width: RAIL_WIDTH_PX + 4 }}
					>
						<button
							aria-expanded={pinned === id}
							aria-label={label}
							className="group/rail flex h-full w-full cursor-pointer items-stretch border-0 bg-transparent p-0 pl-px outline-none"
							onClick={() =>
								setPinned((current) => (current === id ? null : id))
							}
							type="button"
						>
							<span
								className={cn(
									"block w-[3px] rounded-full bg-[var(--c)] transition-[width,box-shadow] group-hover/rail:w-[5px] group-focus-visible/rail:shadow-[0_0_0_2px_var(--ring)]",
									segment.entry.endedAt === null && "shadow-[var(--glow)]",
									pinned === id && "w-[5px]"
								)}
								style={
									{
										"--c": project
											? `var(--${project.color})`
											: "var(--muted-foreground)",
									} as CSSProperties
								}
							/>
						</button>
						<EntryCard
							entry={segment.entry}
							flip={flip}
							now={now}
							onEdit={(entry) => {
								setPinned(null);
								onEditEntry(entry);
							}}
							open={pinned === id}
							projects={projects}
						/>
					</div>
				);
			})}
		</div>
	);
}
