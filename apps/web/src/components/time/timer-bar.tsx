import { IconPlayerStopFilled } from "@tabler/icons-react";
import { useId } from "react";

import { ProjectName } from "@/components/tasks/project-name";
import { Button } from "@/components/ui/button/button";
import { Spinner } from "@/components/ui/spinner/spinner";
import { useIsDesk } from "@/hooks/use-media-query";
import type { Project } from "@/lib/tasks";
import { formatElapsed, type TimeEntry } from "@/lib/time";
import { TimerInput } from "./timer-input";
import {
	isOptimisticEntry,
	useNow,
	useRunningEntry,
	useStopTimer,
} from "./use-time";

/** The running entry with a stop button, or a form to start one. */
export function TimerBar({
	estimateOf,
	menuPlacement,
	onEdit,
	projects,
}: {
	/** The estimate in minutes of the entry's task, when it has one. */
	estimateOf?: (entry: TimeEntry) => number | null;
	/** Where the entry's suggestions open. */
	menuPlacement?: "bottom" | "top";
	onEdit?: (entry: TimeEntry) => void;
	projects: Project[];
}) {
	const running = useRunningEntry();
	if (running.isPending) {
		return (
			<div className="flex justify-center py-3 text-muted-foreground">
				<Spinner />
			</div>
		);
	}
	return running.data ? (
		<RunningTimer
			entry={running.data}
			estimateMinutes={estimateOf?.(running.data) ?? null}
			onEdit={onEdit}
			projects={projects}
		/>
	) : (
		<TimerInput menuPlacement={menuPlacement} projects={projects} />
	);
}

/**
 * The orbit: progress against the estimate as a thin ring around the star of
 * the Mine mark (Mine Design System, Brand). Full once the estimate is spent.
 */
export function TimerOrbit({ ratio, size }: { ratio: number; size: number }) {
	const radius = size / 2 - 4;
	const circumference = 2 * Math.PI * radius;
	const center = size / 2;
	const prism = useId();
	return (
		<span
			aria-hidden
			className="relative shrink-0 text-primary-text drop-shadow-[0_0_6px_rgba(205,220,245,0.35)]"
			data-slot="timer-orbit"
			style={{ height: size, width: size }}
		>
			<svg
				aria-hidden="true"
				className="absolute inset-0"
				height={size}
				viewBox={`0 0 ${size} ${size}`}
				width={size}
			>
				<defs>
					<linearGradient id={prism} x1="0" x2="1" y1="0" y2="1">
						<stop offset="0%" stopColor="var(--chart-1)" />
						<stop offset="30%" stopColor="var(--chart-2)" />
						<stop offset="55%" stopColor="var(--chart-3)" />
						<stop offset="80%" stopColor="var(--chart-4)" />
						<stop offset="100%" stopColor="var(--chart-5)" />
					</linearGradient>
				</defs>
				<circle
					cx={center}
					cy={center}
					fill="none"
					r={radius}
					stroke="var(--border)"
					strokeWidth="2"
				/>
				<circle
					cx={center}
					cy={center}
					fill="none"
					r={radius}
					stroke={`url(#${CSS.escape(prism)})`}
					strokeDasharray={`${circumference * Math.min(ratio, 1)} ${circumference}`}
					strokeLinecap="round"
					strokeWidth="2"
					transform={`rotate(-90 ${center} ${center})`}
				/>
			</svg>
			<svg
				aria-hidden="true"
				className="absolute"
				height="14"
				style={{ left: center - 7, top: center - 7 }}
				viewBox="0 0 24 24"
				width="14"
			>
				<path
					d="M12 1.5C12.9 8.3 15.7 11.1 22.5 12C15.7 12.9 12.9 15.7 12 22.5C11.1 15.7 8.3 12.9 1.5 12C8.3 11.1 11.1 8.3 12 1.5Z"
					fill="currentColor"
				/>
			</svg>
		</span>
	);
}

export function RunningTimer({
	entry,
	estimateMinutes = null,
	onEdit,
	projects,
}: {
	entry: TimeEntry;
	estimateMinutes?: number | null;
	onEdit?: (entry: TimeEntry) => void;
	projects: Project[];
}) {
	const now = useNow();
	const stop = useStopTimer();
	const isDesk = useIsDesk();
	const project = projects.find((p) => p.id === entry.projectId);
	// Until the server has the entry, it cannot be edited or stopped.
	const saving = isOptimisticEntry(entry);
	const details = (
		<>
			<span className="truncate font-medium desk:text-sm text-[length:var(--m-text-body)]">
				{entry.description || "説明なし"}
			</span>
			<span className="flex min-w-0 items-center gap-1.5 text-muted-foreground text-xs">
				{project ? (
					<ProjectName project={project} projects={projects} />
				) : (
					"プロジェクトなし"
				)}
			</span>
		</>
	);
	return (
		<div className="flex items-center gap-3" data-running="">
			{estimateMinutes ? (
				<TimerOrbit
					ratio={(now - entry.startedAt) / (estimateMinutes * 60_000)}
					size={isDesk ? 44 : 48}
				/>
			) : null}
			{onEdit && !saving ? (
				<button
					className="flex min-w-0 flex-1 cursor-pointer flex-col gap-0.5 border-0 bg-transparent p-0 text-left text-foreground outline-none focus-visible:shadow-[0_0_0_2px_var(--ring)]"
					onClick={() => onEdit(entry)}
					type="button"
				>
					{details}
				</button>
			) : (
				<div className="flex min-w-0 flex-1 flex-col gap-0.5">{details}</div>
			)}
			<span className="flex flex-col items-end">
				<span
					aria-live="off"
					className="font-mono desk:text-base text-lg tabular-nums [text-shadow:var(--glow-text)]"
				>
					{formatElapsed(now - entry.startedAt)}
				</span>
				{estimateMinutes ? (
					<span className="text-muted-foreground text-xs">
						見積もり {estimateMinutes}分
					</span>
				) : null}
			</span>
			<Button
				aria-label="計測を止める"
				className={isDesk ? undefined : "w-[var(--m-control)] px-0"}
				disabled={stop.isPending || saving}
				onClick={() => stop.mutate()}
				size={isDesk ? "icon" : "xl"}
				title="計測を止める"
				type="button"
				variant="destructive"
			>
				<IconPlayerStopFilled aria-hidden />
			</Button>
		</div>
	);
}
